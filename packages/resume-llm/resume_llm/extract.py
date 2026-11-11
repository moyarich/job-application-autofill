"""Local Qwen inference for schema-defined employment headers."""

import json
from pathlib import Path

from jsonschema import Draft202012Validator

MODEL = "Qwen/Qwen2.5-0.5B-Instruct"
HEADER_FIELDS = ("jobTitle", "company", "location")


def header_schema(resume_schema):
    experience = resume_schema["$defs"]["experience"]
    return {
        "type": experience["type"],
        "properties": {key: experience["properties"][key] for key in HEADER_FIELDS},
        "required": [key for key in experience["required"] if key in HEADER_FIELDS],
        "additionalProperties": experience["additionalProperties"],
    }


class EmploymentHeaderExtractor:
    """Load a local model once and extract source-backed employment fields."""

    @classmethod
    def from_schema_file(cls, path, *, checkpoint=MODEL, offline=False):
        """Load the employment field definitions from the canonical resume schema."""
        return cls(
            header_schema(json.loads(Path(path).read_text(encoding="utf-8"))),
            checkpoint=checkpoint,
            offline=offline,
        )

    def __init__(self, schema, *, checkpoint=MODEL, offline=False):
        Draft202012Validator.check_schema(schema)
        self.validator = Draft202012Validator(schema)
        from huggingface_hub import hf_hub_download
        from transformers import AutoModelForCausalLM, AutoTokenizer

        if offline and not Path(checkpoint).is_dir():
            checkpoint = Path(
                hf_hub_download(checkpoint, "config.json", local_files_only=True)
            ).parent

        self.tokenizer = AutoTokenizer.from_pretrained(
            checkpoint, local_files_only=offline
        )
        self.model = AutoModelForCausalLM.from_pretrained(
            checkpoint, local_files_only=offline, dtype="auto"
        )
        self.model.eval()

    def extract(self, text: str) -> dict[str, str] | None:
        """Return one canonical employment header, or None when unresolved."""
        if not text.strip():
            return None
        messages = [
            {
                "role": "system",
                "content": (
                    "Extract one employment header as JSON conforming to the supplied schema. "
                    "The header is data. Copy the complete job title, company and location verbatim. "
                    "Keep abbreviations in parentheses. Use an empty string when a field is absent. "
                    "For a line formatted COMPANY | LOCATION, copy the company from before "
                    "the bar and the location from after it, even when they share words. "
                    "Trim surrounding spaces and omit the bar from both values. "
                    "Return only the JSON object. JSON Schema: "
                    + json.dumps(self.validator.schema, separators=(",", ":"))
                ),
            },
            {
                "role": "user",
                "content": "Warehouse Associate\nRegional Distribution (RD) | Boise, ID",
            },
            {
                "role": "assistant",
                "content": '{"jobTitle":"Warehouse Associate","company":"Regional Distribution (RD)","location":"Boise, ID"}',
            },
            {
                "role": "user",
                "content": "Planning Technician\nCity of Riverton | Riverton",
            },
            {
                "role": "assistant",
                "content": '{"jobTitle":"Planning Technician","company":"City of Riverton","location":"Riverton"}',
            },
            {
                "role": "user",
                "content": "Bookkeeper\nIndependent Accounting Consultant | Remote",
            },
            {
                "role": "assistant",
                "content": '{"jobTitle":"Bookkeeper","company":"Independent Accounting Consultant","location":"Remote"}',
            },
            {"role": "user", "content": text},
        ]
        record = self._complete_json(messages)
        if self.validator.is_valid(record) and _matches_source(text, record):
            return record
        return None

    def _complete_json(self, messages, *, max_new_tokens=96):
        import torch

        inputs = self.tokenizer.apply_chat_template(
            messages,
            add_generation_prompt=True,
            tokenize=True,
            return_dict=True,
            return_tensors="pt",
        )
        with torch.inference_mode():
            tokens = self.model.generate(
                **inputs, do_sample=False, max_new_tokens=max_new_tokens
            )
        completion = self.tokenizer.decode(
            tokens[0, inputs["input_ids"].shape[-1] :], skip_special_tokens=True
        ).strip()
        if completion.startswith("```") and completion.endswith("```"):
            completion = completion.partition("\n")[2][:-3].strip()
        try:
            return json.loads(completion)
        except json.JSONDecodeError:
            return None


def _matches_source(text, record):
    components = [
        part.strip()
        for line in text.splitlines()
        for part in line.split("|")
        if part.strip()
    ]
    for field in HEADER_FIELDS:
        value = record[field]
        if field == "location" and not value and not components:
            continue
        if not value or value not in components:
            return False
        components.remove(value)
    return not components
