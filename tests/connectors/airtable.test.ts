import { describe, expect, it, vi } from "vitest";
import { createAirtableConnector } from "../../packages/connectors/src/airtable.ts";

function fixture(allowWrites = false) {
  const request = vi.fn<typeof fetch>(async () =>
    Response.json({ records: [], offset: "next" }),
  );
  const connector = createAirtableConnector(request);
  const session = connector.connect({
    connectionId: "connection",
    profileId: "profile",
    configuration: { allowWrites },
    getSecret: async () => "test-token",
  });
  return { request, session };
}

describe("Airtable connector", () => {
  it("reads a page using stable field IDs and an opaque offset", async () => {
    const { request, session } = fixture();
    const result = await (await session).callTool("list_records", {
      baseId: "app123",
      tableId: "tbl123",
      offset: "next/offset",
    });
    expect(result).toEqual({ records: [], offset: "next" });
    const [url, options] = request.mock.calls[0];
    expect(String(url)).toBe(
      "https://api.airtable.com/v0/app123/tbl123?pageSize=100&returnFieldsByFieldId=true&offset=next%2Foffset",
    );
    expect(options?.headers).toMatchObject({
      Authorization: "Bearer test-token",
    });
  });

  it("blocks writes unless explicitly enabled", async () => {
    const { request, session } = fixture();
    const connection = await session;
    expect((await connection.listTools()).map((tool) => tool.access)).toEqual([
      "read",
      "read",
      "read",
      "read",
    ]);
    await expect(connection.callTool("create_record", {})).rejects.toThrow(
      "unavailable",
    );
    expect(request).not.toHaveBeenCalled();
  });

  it("updates records without replacing unrelated fields", async () => {
    const { request, session } = fixture(true);
    await (await session).callTool("update_record", {
      baseId: "app123",
      tableId: "tbl123",
      recordId: "rec123",
      fields: { fld123: "Applied" },
    });
    expect(String(request.mock.calls[0][0])).toBe(
      "https://api.airtable.com/v0/app123/tbl123/rec123",
    );
    expect(request.mock.calls[0][1]).toMatchObject({
      method: "PATCH",
      body: JSON.stringify({ fields: { fld123: "Applied" }, returnFieldsByFieldId: true }),
    });
  });

  it("rejects malformed identifiers and closed sessions", async () => {
    const { request, session } = fixture();
    const connection = await session;
    await expect(
      connection.callTool("get_schema", { baseId: "../other" }),
    ).rejects.toThrow("Invalid Airtable identifier");
    await connection.close();
    await expect(connection.callTool("list_bases", {})).rejects.toThrow(
      "closed",
    );
    expect(request).not.toHaveBeenCalled();
  });

  it("does not expose error response bodies", async () => {
    const { request, session } = fixture();
    request.mockResolvedValueOnce(new Response("private data", { status: 403 }));
    await expect(
      (await session).callTool("list_bases", {}),
    ).rejects.toThrow("HTTP 403");
  });
});
