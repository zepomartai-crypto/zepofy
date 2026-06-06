export default function TemplateHeader({ mode, setMode }) {
  return (
    <div className="flex justify-between items-center">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">
          WhatsApp Templates
        </h1>
        <p className="text-sm text-slate-500">
          Create, preview & manage Meta-approved templates
        </p>
      </div>

      {mode === "list" && (
        <button
          onClick={() => setMode("create")}
          className="px-6 py-3 bg-blue-600 text-white rounded-[12px] shadow hover:bg-blue-700"
        >
          ➕ Create Template
        </button>
      )}
    </div>
  );
}
