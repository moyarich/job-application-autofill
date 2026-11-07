import type { DatabaseSync } from "node:sqlite";

/** Prepared, parameterized SQL for the contacts repository. */
export function createContactsStatements(db: DatabaseSync) {
  const insertContact = db.prepare(`INSERT INTO profile_contact
 (id,profile_id,name,is_default,first_name,last_name,email,phone,location,linkedin,github,website,extra_json)
 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const updateContact = db.prepare(`UPDATE profile_contact
 SET first_name=?,last_name=?,email=?,phone=?,location=?,linkedin=?,github=?,website=?,extra_json=?
 WHERE profile_id=? AND id=?`);
  const selectContact =
    db.prepare(`SELECT id,profile_id AS profileId,name,is_default AS isDefault,
 first_name AS firstName,last_name AS lastName,email,phone,location,linkedin AS linkedIn,github,website,extra_json AS extraJson
 FROM profile_contact WHERE profile_id=? AND id=?`);
  const listContactRows =
    db.prepare(`SELECT id,profile_id AS profileId,name,is_default AS isDefault,
 first_name AS firstName,last_name AS lastName,email,phone,location,linkedin AS linkedIn,github,website,extra_json AS extraJson
 FROM profile_contact WHERE profile_id=? ORDER BY is_default DESC,name,id`);
  const getDefaultContact = db.prepare(
    "SELECT id FROM profile_contact WHERE profile_id=? AND is_default=1",
  );
  return { insertContact, updateContact, selectContact, listContactRows, getDefaultContact };
}
