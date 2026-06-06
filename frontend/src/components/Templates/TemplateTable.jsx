import TemplateRow from "./TemplateRow";
import api from "../../api/api";

export default function TemplateTable({ templates, reload }) {
  const submitToMeta = async (id) => {
    await api.post(`/templates/${id}/submit`);
    reload();
  };

  return (
    <div className="bg-white rounded-[12px] border shadow-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-100 text-slate-600">
          <tr>
            <th className="p-4 text-left">Template</th>
            <th className="p-4 text-center">Category</th>
            <th className="p-4 text-center">Status</th>
            <th className="p-4 text-right">Action</th>
          </tr>
        </thead>

        <tbody>
          {templates.length === 0 && (
            <tr>
              <td colSpan="4" className="p-12 text-center text-slate-400">
                No templates found
              </td>
            </tr>
          )}

          {templates.map((t) => (
            <TemplateRow
              key={t._id}
              template={t}
              onSubmit={() => submitToMeta(t._id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
