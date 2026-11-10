import type { ContactManagerData } from "../feature-props";
import { useState, type FormEvent } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { Resume } from "@moyarich/resume";

import {
  addProfileContact,
  updateProfileContact,
  deleteProfileContact,
  chooseDefaultContact,
} from "../../utils/api/client";
import { fields } from "../../constants/fields";
import "./ContactManager.css";

type Contact = Resume["contact"];
const blank = (): Contact => ({
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  location: "",
  linkedIn: "",
  github: "",
  website: "",
});
const values = (entry: Contact) =>
  Object.fromEntries(
    fields.map(({ key }) => [key, entry[key] || ""]),
  ) as Contact;

export function ContactManager({
  controller,
}: {
  controller: ContactManagerData;
}) {
  const { contacts, resumeVersions, activeProfileId, flushPending } =
    controller;
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [label, setLabel] = useState("");
  const [contact, setContact] = useState<Contact>(blank);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  function startNew() {
    setLabel("Primary contact");
    setContact(blank());
    setEditing("new");
    setError("");
  }
  function startEdit(id: string) {
    const record = contacts.find((item) => item.id === id);
    if (!record) return;
    setLabel(record.name);
    setContact(values(record));
    setEditing(id);
    setError("");
  }
  async function action(operation: () => Promise<unknown>) {
    setWorking(true);
    setError("");
    try {
      await flushPending();
      await operation();
      // Reload ensures the editor, resume list, and default contact reflect the same DB state.
      window.location.reload();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save contact changes.",
      );
      setWorking(false);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !label.trim() ||
      !contact.firstName.trim() ||
      !contact.lastName.trim() ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim())
    ) {
      setError(
        "Enter a name for this contact, first and last name, and a valid email address.",
      );
      return;
    }
    void action(() =>
      editing === "new"
        ? addProfileContact(activeProfileId, label, contact)
        : updateProfileContact(activeProfileId, editing!, label, contact),
    );
  }
  function remove(id: string, name: string) {
    if (
      !window.confirm('Delete contact "' + name + '"? This cannot be undone.')
    )
      return;
    void action(() => deleteProfileContact(activeProfileId, id));
  }

  return (
    <section className="panel contact-management" aria-label="Saved contacts">
      <div className="panel-title horizontal">
        <div>
          <h2>Saved contacts</h2>
        </div>
        <button
          type="button"
          className="primary"
          onClick={startNew}
          disabled={working}
        >
          <Plus size={16} /> New contact
        </button>
      </div>
      {error && (
        <p className="contact-management-error" role="alert">
          {error}
        </p>
      )}
      {contacts.length === 0 ? (
        <div className="contact-management-empty">No contacts yet.</div>
      ) : (
        <div className="contact-management-list">
          {contacts.map((item) => {
            const usages = resumeVersions.filter(
              (resume) => resume.contactId === item.id,
            ).length;
            return (
              <article className="contact-management-record" key={item.id}>
                <div className="contact-management-avatar" aria-hidden="true">
                  {item.firstName.slice(0, 1).toUpperCase()}
                  {item.lastName.slice(0, 1).toUpperCase()}
                </div>
                <div className="contact-management-details">
                  <div className="contact-management-label">
                    {item.name}{" "}
                    {item.isDefault && (
                      <span className="contact-management-default">
                        Default
                      </span>
                    )}
                  </div>
                  <strong>
                    {[item.firstName, item.lastName].filter(Boolean).join(" ")}
                  </strong>
                  <span>
                    {item.email}
                    {item.phone ? " · " + item.phone : ""}
                  </span>
                  <small>
                    {usages} {usages === 1 ? "resume" : "resumes"} using this
                    contact
                  </small>
                </div>
                <div className="contact-management-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => startEdit(item.id)}
                    disabled={working}
                  >
                    <Pencil size={14} /> Edit
                  </button>
                  {!item.isDefault && (
                    <button
                      type="button"
                      className="secondary"
                      disabled={working}
                      onClick={() =>
                        void action(() =>
                          chooseDefaultContact(activeProfileId, item.id),
                        )
                      }
                    >
                      Make default
                    </button>
                  )}
                  <button
                    type="button"
                    className="secondary contact-management-delete"
                    disabled={working || usages > 0}
                    title={
                      usages > 0
                        ? "Change or unlink this contact on its resumes before deleting."
                        : "Delete contact"
                    }
                    onClick={() => remove(item.id, item.name)}
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {contacts.some((item) =>
        resumeVersions.some((resume) => resume.contactId === item.id),
      ) && (
        <p className="contact-management-help">
          To delete a contact used by a resume, open the Resume editor and
          select a different contact or “Draft — no saved contact” first.
        </p>
      )}
      {editing && (
        <form className="contact-management-form" onSubmit={submit}>
          <div className="contact-management-form-heading">
            <h3>{editing === "new" ? "New contact" : "Edit contact"}</h3>
            <button
              type="button"
              className="secondary"
              disabled={working}
              onClick={() => {
                setEditing(null);
                setError("");
              }}
              aria-label="Cancel contact changes"
            >
              <X size={16} />
            </button>
          </div>
          <label>
            Contact label
            <input
              required
              maxLength={80}
              value={label}
              placeholder="Personal, work, or preferred"
              onChange={(event) => setLabel(event.target.value)}
            />
          </label>
          <div className="contact-management-fields">
            {fields.map(({ key, label: fieldLabel }) => (
              <label key={key}>
                {fieldLabel}
                <input
                  type={key === "email" ? "email" : "text"}
                  value={contact[key] || ""}
                  placeholder={fieldLabel}
                  required={
                    key === "firstName" || key === "lastName" || key === "email"
                  }
                  onChange={(event) =>
                    setContact((previous) => ({
                      ...previous,
                      [key]: event.target.value,
                    }))
                  }
                />
              </label>
            ))}
          </div>
          <div className="actions">
            <button type="submit" className="primary" disabled={working}>
              <Check size={15} /> {working ? "Saving..." : "Save contact"}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={working}
              onClick={() => setEditing(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
