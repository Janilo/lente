// Server-only HubSpot helpers — direct HubSpot CRM API (api.hubapi.com).
// Auth: HUBSPOT_API_KEY = token de Private App (Bearer). Sem Lovable.
const GATEWAY_URL = "https://api.hubapi.com";

function authHeaders() {
  const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
  if (!HUBSPOT_API_KEY) throw new Error("HUBSPOT_API_KEY is not configured");
  return {
    Authorization: `Bearer ${HUBSPOT_API_KEY}`,
    "Content-Type": "application/json",
  };
}

let propsEnsured: Promise<boolean> | null = null;

async function ensureCustomProperties(): Promise<boolean> {
  if (propsEnsured) return propsEnsured;
  propsEnsured = (async () => {
    const groupName = "contactinformation";
    const defs = [
      {
        name: "lente_role",
        label: "Lente Role",
        type: "enumeration",
        fieldType: "select",
        groupName,
        options: [
          { label: "Researcher", value: "researcher", displayOrder: 1 },
          { label: "Respondent", value: "respondent", displayOrder: 2 },
        ],
      },
      {
        name: "lente_signup_source",
        label: "Lente Signup Source",
        type: "string",
        fieldType: "text",
        groupName,
      },
      {
        name: "lente_last_study_title",
        label: "Lente Last Study Title",
        type: "string",
        fieldType: "text",
        groupName,
      },
      {
        name: "lente_last_study_slug",
        label: "Lente Last Study Slug",
        type: "string",
        fieldType: "text",
        groupName,
      },
    ];
    try {
      for (const def of defs) {
        const res = await fetch(`${GATEWAY_URL}/crm/v3/properties/contacts`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify(def),
        });
        if (!res.ok && res.status !== 409) {
          const txt = await res.text();
          console.warn(`[hubspot] could not create property ${def.name} [${res.status}]: ${txt}`);
          // If we can't create custom props, skip them entirely.
          if (res.status === 401 || res.status === 403) return false;
        }
      }
      return true;
    } catch (e) {
      console.warn("[hubspot] ensureCustomProperties failed:", e);
      return false;
    }
  })();
  return propsEnsured;
}

function splitName(full?: string) {
  if (!full) return { firstname: undefined, lastname: undefined };
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { firstname: parts[0], lastname: undefined };
  return { firstname: parts[0], lastname: parts.slice(1).join(" ") };
}

type Role = "researcher" | "respondent";

export async function syncContact(input: {
  email: string;
  full_name?: string | null;
  role: Role;
  study?: { id: string; title: string; slug: string } | null;
}): Promise<void> {
  const email = input.email?.trim().toLowerCase();
  if (!email) return;

  const haveCustom = await ensureCustomProperties();
  const { firstname, lastname } = splitName(input.full_name ?? undefined);

  // Lookup existing
  let contactId: string | null = null;
  let existingRole: string | null = null;
  try {
    const lookupUrl = `${GATEWAY_URL}/crm/v3/objects/contacts/${encodeURIComponent(email)}?idProperty=email&properties=email,lente_role`;
    const lookup = await fetch(lookupUrl, { method: "GET", headers: authHeaders() });
    if (lookup.ok) {
      const json = (await lookup.json()) as { id?: string; properties?: Record<string, string> };
      contactId = json.id ?? null;
      existingRole = json.properties?.lente_role ?? null;
    } else if (lookup.status !== 404) {
      const txt = await lookup.text();
      console.warn(`[hubspot] lookup failed [${lookup.status}]: ${txt}`);
    }
  } catch (e) {
    console.warn("[hubspot] lookup error:", e);
  }

  const properties: Record<string, string> = {
    email,
    lifecyclestage: "lead",
  };
  if (firstname) properties.firstname = firstname;
  if (lastname) properties.lastname = lastname;
  if (haveCustom) {
    properties.lente_signup_source = "lente_app";
    // don't downgrade researcher -> respondent
    const nextRole = existingRole === "researcher" ? "researcher" : input.role;
    properties.lente_role = nextRole;
    if (input.study) {
      properties.lente_last_study_title = input.study.title.slice(0, 255);
      properties.lente_last_study_slug = input.study.slug.slice(0, 255);
    }
  }

  try {
    if (contactId) {
      const res = await fetch(`${GATEWAY_URL}/crm/v3/objects/contacts/${contactId}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ properties }),
      });
      if (!res.ok) {
        const txt = await res.text();
        console.warn(`[hubspot] update contact failed [${res.status}]: ${txt}`);
      }
    } else {
      const res = await fetch(`${GATEWAY_URL}/crm/v3/objects/contacts`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ properties }),
      });
      if (res.ok) {
        const json = (await res.json()) as { id?: string };
        contactId = json.id ?? null;
      } else {
        const txt = await res.text();
        console.warn(`[hubspot] create contact failed [${res.status}]: ${txt}`);
      }
    }
  } catch (e) {
    console.warn("[hubspot] upsert error:", e);
  }

  // Create + associate note
  if (contactId) {
    const now = new Date();
    const body =
      input.role === "researcher"
        ? `Novo pesquisador cadastrado em Lente — ${now.toLocaleString("pt-BR")}.`
        : `Respondente cadastrado${input.study ? ` para o estudo "${input.study.title}" (${input.study.slug})` : ""} em ${now.toLocaleString("pt-BR")}.`;
    try {
      const noteRes = await fetch(`${GATEWAY_URL}/crm/v3/objects/notes`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          properties: { hs_note_body: body, hs_timestamp: now.toISOString() },
        }),
      });
      if (noteRes.ok) {
        const noteJson = (await noteRes.json()) as { id?: string };
        const noteId = noteJson.id;
        if (noteId) {
          const assoc = await fetch(
            `${GATEWAY_URL}/crm/v3/objects/notes/${noteId}/associations/contacts/${contactId}/note_to_contact`,
            { method: "PUT", headers: authHeaders() },
          );
          if (!assoc.ok) {
            const txt = await assoc.text();
            console.warn(`[hubspot] note association failed [${assoc.status}]: ${txt}`);
          }
        }
      } else {
        const txt = await noteRes.text();
        console.warn(`[hubspot] create note failed [${noteRes.status}]: ${txt}`);
      }
    } catch (e) {
      console.warn("[hubspot] note error:", e);
    }
  }
}
