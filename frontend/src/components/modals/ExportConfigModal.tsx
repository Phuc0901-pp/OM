import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import api from '../../services/api';
import {
  X, FileText, Loader2, ChevronDown, ChevronUp,
  ClipboardList, Cpu, Settings, MessageSquare, Image, Eye
} from 'lucide-react';

// ── Types matching backend preview API ──────────────────────────────────────
interface PreviewTemplate {
  template_name: string;
  status: string;
  submit_date: string;
  approve_date: string;
  image_url: string;
}
interface PreviewAsset {
  parent_name: string;
  asset_name: string;
  processes: string[];
  templates: PreviewTemplate[];
  image_count: number;
  image_folder_url: string;
}
interface PreviewSubWork {
  sub_work_name: string;
  assets: PreviewAsset[];
}
interface PreviewWork {
  work_name: string;
  sub_works: PreviewSubWork[];
}

interface ExportConfigModalProps {
  isOpen: boolean;
  projectId: string;
  projectName: string;
  onClose: () => void;
}

// Helper: group assets by parent_name for display
function groupByParent(assets: PreviewAsset[]): { parent: string; children: PreviewAsset[] }[] {
  const order: string[] = [];
  const map: Record<string, PreviewAsset[]> = {};
  for (const a of assets) {
    if (!map[a.parent_name]) {
      order.push(a.parent_name);
      map[a.parent_name] = [];
    }
    map[a.parent_name].push(a);
  }

  // Sort parent groups alphanumerically
  order.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  return order.map(p => {
    // Sort children assets alphanumerically
    const sortedChildren = [...map[p]].sort((a, b) =>
      a.asset_name.localeCompare(b.asset_name, undefined, { numeric: true, sensitivity: 'base' })
    );
    return { parent: p, children: sortedChildren };
  });
}

function swKey(workName: string, subWorkName: string) {
  return `${workName}|${subWorkName}`;
}

function statusColor(status: string | undefined) {
  switch (status) {
    case 'Đã xong': return 'bg-green-100 text-green-700';
    case 'Điều chỉnh xong': return 'bg-purple-100 text-purple-700';
    case 'Chờ duyệt': return 'bg-amber-100 text-amber-700';
    case 'Nộp lại': return 'bg-cyan-100 text-cyan-700';
    case 'Từ chối': return 'bg-red-100 text-red-700';
    case 'Đang làm': return 'bg-blue-100 text-blue-700';
    default: return 'bg-slate-100 text-slate-400';
  }
}

const ExportConfigModal = ({ isOpen, projectId, projectName, onClose }: ExportConfigModalProps) => {
  const [tree, setTree] = useState<PreviewWork[]>([]);
  const [subWorkComments, setSubWorkComments] = useState<Record<string, string>>({});
  const [conclusion, setConclusion] = useState('');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [collapsedWorks, setCollapsedWorks] = useState<Record<string, boolean>>({});
  const [collapsedSubs, setCollapsedSubs] = useState<Record<string, boolean>>({});
  const [selectedAssetForDetail, setSelectedAssetForDetail] = useState<PreviewAsset | null>(null);
  const [selectedTemplateUrl, setSelectedTemplateUrl] = useState<string>('');

  const fetchPreview = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const res = await api.get(`/projects/${projectId}/export-preview`);
      const data: PreviewWork[] = Array.isArray(res.data) ? res.data : [];
      setTree(data);
      const init: Record<string, string> = {};
      data.forEach(w =>
        w.sub_works.forEach(sw => { init[swKey(w.work_name, sw.sub_work_name)] = ''; })
      );
      setSubWorkComments(init);
      setCollapsedWorks({});
      setCollapsedSubs({});
    } catch {
      setTree([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (isOpen) { fetchPreview(); setConclusion(''); }
  }, [isOpen, fetchPreview]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await api.post(
        `/projects/${projectId}/export`,
        { sub_work_comments: subWorkComments, conclusion },
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Export_Project_${projectName}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      onClose();
    } catch {
      alert('Xuất cấu hình thất bại. Vui lòng thử lại.');
    } finally {
      setExporting(false);
    }
  };

  const countFilled = Object.values(subWorkComments).filter(v => v.trim()).length;

  if (!isOpen) return null;

  // Grid columns: 7 cols: Nhóm | Thiết bị | Ảnh | Quy trình | Tên mẫu | Trạng thái | Nộp/Duyệt
  const gridCols = '1fr 1fr 0.45fr 1fr 1.1fr 0.85fr 0.85fr';

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div
        className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-100 flex flex-col"
        style={{ maxHeight: '92vh' }}
      >
        {/* ── Header ── */}
        <div className="bg-gradient-to-r from-indigo-700 to-blue-600 px-6 py-5 shrink-0 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Xuất File Cấu Hình PDF</h3>
                <p className="text-indigo-100 text-xs mt-0.5 line-clamp-1">{projectName}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white hover:bg-white/20 rounded-lg p-1.5 transition-all">
              <X className="w-5 h-5" />
            </button>
          </div>
          {!loading && tree.length > 0 && (
            <div className="flex gap-3 mt-3 flex-wrap">
              <span className="text-xs bg-white/15 text-white px-2.5 py-1 rounded-full">
                {tree.length} hạng mục
              </span>
              <span className="text-xs bg-white/15 text-white px-2.5 py-1 rounded-full">
                {tree.reduce((acc, w) => acc + w.sub_works.length, 0)} công việc con
              </span>
              {countFilled > 0 && (
                <span className="text-xs bg-amber-400/30 text-amber-100 px-2.5 py-1 rounded-full">
                  {countFilled} nhận xét đã điền
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
            <ClipboardList className="w-4 h-4 mt-0.5 shrink-0 text-blue-500" />
            <span>Xem danh sách thiết bị, quy trình & trạng thái công việc, rồi điền nhận xét (không bắt buộc) trước khi xuất PDF.</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Đang tải cấu hình dự án...</span>
            </div>
          ) : tree.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">Dự án chưa có cấu hình nào.</div>
          ) : (
            tree.map((work) => {
              const wCollapsed = collapsedWorks[work.work_name];
              return (
                <div key={work.work_name} className="border border-indigo-100 rounded-xl overflow-hidden shadow-sm">
                  {/* Work header */}
                  <button
                    onClick={() => setCollapsedWorks(p => ({ ...p, [work.work_name]: !p[work.work_name] }))}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 text-white"
                  >
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-indigo-200 shrink-0" />
                      <span className="font-bold text-sm text-left">{work.work_name}</span>
                      <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">{work.sub_works.length} mục</span>
                    </div>
                    {wCollapsed
                      ? <ChevronDown className="w-4 h-4 text-white/70 shrink-0" />
                      : <ChevronUp className="w-4 h-4 text-white/70 shrink-0" />}
                  </button>

                  {/* SubWorks */}
                  {!wCollapsed && (
                    <div className="divide-y divide-slate-100 bg-white">
                      {work.sub_works.map((sw) => {
                        const key = swKey(work.work_name, sw.sub_work_name);
                        const swCollapsed = collapsedSubs[key];
                        const hasComment = !!subWorkComments[key]?.trim();
                        const groups = groupByParent(sw.assets);

                        return (
                          <div key={key} className="px-4 py-3 space-y-2">
                            {/* SubWork label row */}
                            <button
                              onClick={() => setCollapsedSubs(p => ({ ...p, [key]: !p[key] }))}
                              className="w-full flex items-center justify-between group"
                            >
                              <div className="flex items-center gap-2">
                                <Settings className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                <span className="text-sm font-semibold text-slate-700 group-hover:text-indigo-600 transition-colors text-left">
                                  {sw.sub_work_name}
                                </span>
                                {hasComment && (
                                  <span className="text-[10px] bg-amber-100 text-amber-700 font-medium px-1.5 py-0.5 rounded-full border border-amber-200 shrink-0">
                                    Có nhận xét
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[10px] text-slate-400">{sw.assets.length} thiết bị</span>
                                {swCollapsed
                                  ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                                  : <ChevronUp className="w-3.5 h-3.5 text-slate-400" />}
                              </div>
                            </button>

                            {/* Asset table — 7 cols: Nhóm | Thiết bị | Ảnh | Quy trình | Tên mẫu | Trạng thái | Nộp/Duyệt */}
                            {!swCollapsed && (
                              <div className="space-y-2 pl-2">
                                <div className="rounded-lg overflow-hidden border border-slate-100">
                                  {/* Header */}
                                  <div
                                    className="grid gap-2 bg-slate-50 border-b border-slate-100 text-[10px] font-bold uppercase text-slate-400 tracking-wider px-2 py-1.5"
                                    style={{ gridTemplateColumns: gridCols }}
                                  >
                                    <span>Nhóm</span>
                                    <span>Thiết bị</span>
                                    <span>Ảnh</span>
                                    <span>Quy trình</span>
                                    <span>Tên mẫu</span>
                                    <span>Trạng thái</span>
                                    <span>Nộp / Duyệt</span>
                                  </div>

                                  {/* Rows */}
                                  {groups.map(g =>
                                    g.children.map((asset, ai) => {
                                      const tpls = asset.templates || [];
                                      const rows = tpls.length > 0 ? tpls : [null];
                                      return rows.map((tpl, ti) => (
                                        <div
                                          key={`${g.parent}-${ai}-${ti}`}
                                          className="grid gap-2 px-2 py-2 text-xs border-b border-slate-50 last:border-b-0 hover:bg-slate-50/60 items-start"
                                          style={{ gridTemplateColumns: gridCols }}
                                        >
                                          {/* Col 1: Parent — only on first row of first asset in group */}
                                          <span className="text-indigo-600 font-medium truncate">
                                            {ti === 0 && ai === 0 ? g.parent : ''}
                                          </span>

                                          {/* Col 2: Asset name — only on first template row */}
                                          <span className="text-slate-700 truncate">
                                            {ti === 0 ? `↳ ${asset.asset_name}` : ''}
                                          </span>

                                          {/* Col 3: Eye icon — per template row, opens modal with this template's url */}
                                          <span className="flex items-center justify-center">
                                            <button
                                              onClick={() => {
                                                setSelectedAssetForDetail(asset);
                                                setSelectedTemplateUrl(tpl?.image_url || asset.image_folder_url || '');
                                              }}
                                              type="button"
                                              title="Xem chi tiết dữ liệu"
                                              className="inline-flex items-center justify-center p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                            >
                                              <Eye className="w-3.5 h-3.5" />
                                            </button>
                                          </span>

                                          {/* Col 4: Processes — only on first template row of each asset */}
                                          <span className="text-slate-600">
                                            {ti === 0 ? (
                                              (asset.processes || []).length > 0 ? (
                                                <div className="flex flex-col gap-0.5">
                                                  {asset.processes.map((proc, pidx) => (
                                                    <div key={pidx} className="flex items-start gap-1">
                                                      <span className="text-slate-300 shrink-0 mt-0.5">•</span>
                                                      <span className="leading-relaxed">{proc}</span>
                                                    </div>
                                                  ))}
                                                </div>
                                              ) : <span className="text-slate-400 italic">Khác</span>
                                            ) : ''}
                                          </span>

                                          {/* Col 5: Template name — per template row */}
                                          <span className="text-slate-700 leading-relaxed">
                                            {tpl ? tpl.template_name : <span className="text-slate-300">—</span>}
                                          </span>

                                          {/* Col 6: Status badge */}
                                          <span className="flex items-center">
                                            {tpl
                                              ? <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium ${statusColor(tpl.status)}`}>
                                                  {tpl.status}
                                                </span>
                                              : <span className="text-slate-300">—</span>}
                                          </span>

                                          {/* Col 7: Dates */}
                                          <span className="text-slate-400 text-[10px] leading-5">
                                            {tpl?.submit_date && <div className="whitespace-nowrap">N: {tpl.submit_date}</div>}
                                            {tpl?.approve_date && <div className="whitespace-nowrap">D: {tpl.approve_date}</div>}
                                            {!tpl?.submit_date && !tpl?.approve_date && <span className="text-slate-300">—</span>}
                                          </span>
                                        </div>
                                      ));
                                    })
                                  )}
                                </div>

                                {/* Comment textarea */}
                                <div className="flex items-start gap-2">
                                  <MessageSquare className="w-3.5 h-3.5 text-amber-500 mt-2.5 shrink-0" />
                                  <textarea
                                    rows={2}
                                    className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl bg-amber-50/40
                                      text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2
                                      focus:ring-amber-300 focus:border-amber-400 resize-none transition-shadow"
                                    placeholder={`Nhận xét cho "${sw.sub_work_name}"...`}
                                    value={subWorkComments[key] ?? ''}
                                    onChange={e => setSubWorkComments(prev => ({ ...prev, [key]: e.target.value }))}
                                  />
                                </div>
                              </div>
                            )}

                            {/* Quick comment when collapsed */}
                            {swCollapsed && (
                              <div className="flex items-start gap-2 pl-2">
                                <MessageSquare className={`w-3.5 h-3.5 mt-2.5 shrink-0 ${hasComment ? 'text-amber-500' : 'text-slate-300'}`} />
                                <textarea
                                  rows={1}
                                  className="flex-1 px-3 py-1.5 text-sm border border-slate-100 rounded-xl bg-slate-50
                                    text-slate-600 placeholder:text-slate-300 focus:outline-none focus:ring-1
                                    focus:ring-amber-200 focus:border-amber-300 resize-none transition-shadow"
                                  placeholder={`Nhận xét cho "${sw.sub_work_name}"... (click để xem chi tiết)`}
                                  value={subWorkComments[key] ?? ''}
                                  onChange={e => setSubWorkComments(prev => ({ ...prev, [key]: e.target.value }))}
                                  onClick={() => setCollapsedSubs(p => ({ ...p, [key]: false }))}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* ── Conclusion ── */}
          <div className="border border-indigo-200 rounded-xl overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-indigo-100">
              <ClipboardList className="w-4 h-4 text-indigo-500" />
              <span className="text-sm font-bold text-indigo-700">Kết luận chung</span>
              <span className="text-[10px] text-indigo-400 ml-1">(xuất ở trang cuối PDF)</span>
            </div>
            <div className="px-4 pb-4 pt-3 bg-white">
              <textarea
                rows={4}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50/60 text-slate-700
                  placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400
                  resize-none transition-shadow"
                placeholder="Nhập kết luận chung, đánh giá tổng thể dự án... (để trống sẽ in dòng kẻ chờ ký tay)"
                value={conclusion}
                onChange={e => setConclusion(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="shrink-0 px-6 py-4 border-t border-slate-100 flex gap-3 bg-slate-50/80 rounded-b-2xl">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-100 transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600
              text-white text-sm font-semibold hover:from-indigo-700 hover:to-blue-700
              disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-md"
          >
            {exporting
              ? <><Loader2 className="w-4 h-4 animate-spin" />Đang xuất...</>
              : <><FileText className="w-4 h-4" />Xuất PDF</>}
          </button>
        </div>
      </div>
    </div>
  );


  return createPortal(
    <>
      {modalContent}
      {/* Modal hiển thị chi tiết Dữ liệu của 1 Tài sản */}
      {selectedAssetForDetail && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-white" />
                <h3 className="text-lg font-bold text-white">Chi tiết dữ liệu tài sản</h3>
              </div>
              <button onClick={() => { setSelectedAssetForDetail(null); setSelectedTemplateUrl(''); }} className="text-white/70 hover:text-white hover:bg-white/20 p-1.5 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5 overflow-y-auto max-h-[70vh]">
              {/* Info */}
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tên tài sản / Thiết bị</p>
                <p className="text-base font-semibold text-slate-800">{selectedAssetForDetail.asset_name}</p>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Thuộc nhóm</p>
                <p className="text-sm font-medium text-indigo-600">{selectedAssetForDetail.parent_name}</p>
              </div>

              {/* Processes */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1">Các quy trình thực hiện ({selectedAssetForDetail.processes?.length || 0})</p>
                {selectedAssetForDetail.processes && selectedAssetForDetail.processes.length > 0 ? (
                  <ul className="space-y-2 mt-2">
                    {selectedAssetForDetail.processes.map((proc, idx) => (
                      <li key={idx} className="flex gap-2 text-sm text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <span className="text-indigo-400 font-bold shrink-0">{idx + 1}.</span>
                        <span className="leading-relaxed">{proc}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-400 italic mt-2">Khác</p>
                )}
              </div>

              {/* Images info */}
              {selectedTemplateUrl ? (
                <a href={selectedTemplateUrl} target="_blank" rel="noreferrer" className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl transition-colors shadow-sm">
                  <Image className="w-4 h-4" /> Xem ảnh của mẫu này
                </a>
              ) : (
                <button disabled className="w-full flex items-center justify-center gap-2 bg-slate-100 text-slate-400 font-medium py-2.5 rounded-xl cursor-not-allowed border border-slate-200">
                  <Image className="w-4 h-4 opacity-50" /> Chưa có thư mục ảnh
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  );
};

export default ExportConfigModal;
