import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  readContacts, updateProfileContact, type ProfileContact,
} from "../utils/api/client";

const contactValues = (entry: ProfileContact) => {
  const { id: _id, profileId: _profileId, name: _name, isDefault: _isDefault, ...contact } = entry;
  return contact;
};
const signature = (entry: ProfileContact) =>
  JSON.stringify({ name: entry.name, contact: contactValues(entry) });

/** Owns contact records and contact-record writes only. */
export function useProfileContacts({
  profileId, enabled, setMessage,
}: {
  profileId: string;
  enabled: boolean;
  setMessage: Dispatch<SetStateAction<string>>;
}) {
  const [contacts, setContacts] = useState<ProfileContact[]>([]);
  const [defaultContactId, setDefaultContactId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const saved = useRef(new Map<string, string>());
  const queue = useRef<Promise<void>>(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blocked = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setHydrated(false);
    readContacts(profileId).then((items) => {
      if (cancelled) return;
      saved.current = new Map(items.map((item) => [item.id, signature(item)]));
      setContacts(items);
      setDefaultContactId(items.find((item) => item.isDefault)?.id ?? null);
      blocked.current = false;
      setHydrated(true);
    }).catch((error) => {
      if (!cancelled) setMessage("Could not load contacts: " + String(error));
    });
    return () => { cancelled = true; };
  }, [profileId, enabled]);

  async function persistContacts() {
    if (blocked.current) throw new Error("Contact changes could not be saved.");
    for (const item of contacts) {
      const next = signature(item);
      if (next === saved.current.get(item.id)) continue;
      await updateProfileContact(profileId, item.id, item.name, contactValues(item));
      saved.current.set(item.id, next);
    }
  }

  useEffect(() => {
    if (!hydrated || blocked.current) return;
    if (!contacts.some((item) => signature(item) !== saved.current.get(item.id))) return;
    const current = setTimeout(() => {
      queue.current = queue.current.then(persistContacts).catch((error) => {
        blocked.current = true;
        setMessage("Could not save contacts: " + String(error));
      });
    }, 350);
    timer.current = current;
    return () => clearTimeout(current);
  }, [contacts, hydrated, profileId]);

  async function flushContacts() {
    if (timer.current) clearTimeout(timer.current);
    await queue.current;
    if (blocked.current) throw new Error("Contact changes could not be saved.");
    await persistContacts();
  }

  return {
    contacts, setContacts, defaultContactId, setDefaultContactId,
    contactsHydrated: hydrated, flushContacts,
  };
}
