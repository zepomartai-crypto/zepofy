export default function TemplateRow({ template, onSubmit }) {
  const badge =
    template.metaStatus === "approved"
      ? "bg-blue-100 text-blue-700"
      : template.metaStatus === "pending"
      ? "bg-yellow-100 text-yellow-700"
      : "bg-slate-200 text-slate-700";

  return (
    <tr className="border-t hover:bg-slate-50">
      <td className="p-4">
        <div className="font-medium">{template.name}</div>
        <div className="text-xs text-slate-500">
          {template.metaTemplateName}
        </div>
      </td>

      <td className="p-4 text-center">{template.category}</td>

      <td className="p-4 text-center">
        <span className={`px-3 py-1 rounded-full text-xs ${badge}`}>
          {template.metaStatus}
        </span>
      </td>

      <td className="p-4 text-right">
        {template.metaStatus === "draft" ? (
          <button
            onClick={onSubmit}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs"
          >
            Submit
          </button>
        ) : (
          "—"
        )}
      </td>
    </tr>
  );
}
