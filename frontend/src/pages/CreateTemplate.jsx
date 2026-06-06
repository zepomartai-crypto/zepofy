import { useState } from "react";
import api from "../api/api";

export default function CreateTemplate() {
  const [form, setForm] = useState({
    name: "",
    category: "MARKETING",
    header: { type: "text", text: "" },
    body: "",
    footer: "",
    buttons: [],
  });

  const submit = async () => {
    await api.post("/templates", form);
    alert("Template saved");
  };

  return (
    <div className="grid grid-cols-2 gap-6 p-6">
      {/* LEFT FORM */}
      <div>
        <h2 className="font-semibold mb-2">Template Body</h2>

        <select
          value={form.header.type}
          onChange={(e) =>
            setForm({ ...form, header: { type: e.target.value } })
          }
          className="border p-2 w-full mb-2"
        >
          <option value="text">Text Header</option>
          <option value="image">Image Header</option>
        </select>

        {form.header.type === "text" && (
          <input
            className="border p-2 w-full mb-3"
            placeholder="Header text"
            onChange={(e) =>
              setForm({ ...form, header: { ...form.header, text: e.target.value } })
            }
          />
        )}

        <textarea
          className="border p-3 w-full"
          placeholder="Body text {{1}}"
          rows={5}
          onChange={(e) => setForm({ ...form, body: e.target.value })}
        />

        <input
          className="border p-2 w-full mt-2"
          placeholder="Footer (optional)"
          onChange={(e) => setForm({ ...form, footer: e.target.value })}
        />

        <button
          onClick={submit}
          className="bg-blue-600 text-white px-4 py-2 mt-4 rounded"
        >
          Save Template
        </button>
      </div>

      {/* RIGHT PREVIEW */}
      <div className="bg-[#efeae2] p-4 rounded">
        <div className="bg-white p-3 rounded space-y-2">
          {form.header.text && <b>{form.header.text}</b>}
          <p>{form.body || "Message preview"}</p>
          {form.footer && (
            <p className="text-xs text-gray-400">{form.footer}</p>
          )}
        </div>
      </div>
    </div>
  );
}
