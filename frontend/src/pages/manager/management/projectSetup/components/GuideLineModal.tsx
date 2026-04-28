import React, { useState, useEffect, useRef } from 'react';
import { X, BookOpen, Link2, ImagePlus, Trash2, UploadCloud, Loader2, Save, ExternalLink } from 'lucide-react';
import api from '../../../../../services/api';

interface GuideLine {
  id?: string;
  id_sub_work: string;
  guide_text: string;
  guide_images: string[];
  guide_url: string;
}

interface GuideLineModalProps {
  subWorkId: string;
  subWorkName: string;
  workName: string;
  onClose: () => void;
  readOnly?: boolean;
}

export default function GuideLineModal({ subWorkId, subWorkName, workName, onClose, readOnly }: GuideLineModalProps) {
  const [data, setData] = useState<GuideLine>({
    id_sub_work: subWorkId,
    guide_text: '',
    guide_images: [],
    guide_url: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchGuideLine();
  }, [subWorkId]);

  const fetchGuideLine = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/guidelines/subwork/${subWorkId}`);
      const raw = res.data;
      // guide_images might come as JSON string or array
      let images: string[] = [];
      if (Array.isArray(raw.guide_images)) {
        images = raw.guide_images;
      } else if (typeof raw.guide_images === 'string') {
        try { images = JSON.parse(raw.guide_images); } catch { images = []; }
      }
      setData({
        id_sub_work: subWorkId,
        guide_text: raw.guide_text || '',
        guide_images: images,
        guide_url: raw.guide_url || '',
      });
    } catch {
      setData({ id_sub_work: subWorkId, guide_text: '', guide_images: [], guide_url: '' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post(`/guidelines/subwork/${subWorkId}`, {
        guide_text: data.guide_text,
        guide_images: data.guide_images,
        guide_url: data.guide_url,
      });
      setSaved(true);
      setIsEditing(false);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      alert('Lưu thất bại! Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('target', 'guidelines');
    try {
      const res = await api.post('/upload/guideline', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.url) {
        setData(prev => ({ ...prev, guide_images: [...prev.guide_images, res.data.url] }));
      }
    } catch {
      alert('Tải ảnh thất bại!');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = (url: string) => {
    setData(prev => ({ ...prev, guide_images: prev.guide_images.filter(u => u !== url) }));
  };

  const hasContent = data.guide_text || data.guide_url || data.guide_images.length > 0;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 9999999 }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-emerald-500 p-5 text-white shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-teal-100 mb-0.5">{workName}</p>
                <h2 className="text-lg font-bold leading-tight">{subWorkName}</h2>
                <p className="text-xs text-teal-100 mt-0.5">Hướng dẫn công việc</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors shrink-0 mt-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
              <p className="text-sm font-medium">Đang tải hướng dẫn...</p>
            </div>
          ) : (
            <>
              {/* Guide Text */}
              <div>
                <label className="block text-[11px] uppercase font-bold text-slate-500 mb-2 tracking-wider flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-teal-500" />
                  Nội dung hướng dẫn
                </label>
                {isEditing ? (
                  <textarea
                    rows={5}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 text-sm text-slate-700 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all resize-none"
                    placeholder="Nhập nội dung hướng dẫn, lưu ý an toàn, quy trình thực hiện..."
                    value={data.guide_text}
                    onChange={e => setData(prev => ({ ...prev, guide_text: e.target.value }))}
                  />
                ) : (
                  <div className={`px-4 py-3 rounded-xl border text-sm leading-relaxed min-h-[100px] ${data.guide_text ? 'bg-teal-50/50 border-teal-100 text-slate-700 whitespace-pre-wrap' : 'bg-slate-50 border-slate-100 text-slate-400 italic'}`}>
                    {data.guide_text || 'Chưa có nội dung hướng dẫn.'}
                  </div>
                )}
              </div>

              {/* Guide URL */}
              <div>
                <label className="block text-[11px] uppercase font-bold text-slate-500 mb-2 tracking-wider flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 text-blue-500" />
                  URL hướng dẫn (Video / Tài liệu)
                </label>
                {isEditing ? (
                  <input
                    type="url"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                    placeholder="https://youtube.com/... hoặc https://drive.google.com/..."
                    value={data.guide_url}
                    onChange={e => setData(prev => ({ ...prev, guide_url: e.target.value }))}
                  />
                ) : data.guide_url ? (
                  <a
                    href={data.guide_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 text-sm font-medium hover:bg-blue-100 transition-colors group"
                  >
                    <ExternalLink className="w-4 h-4 shrink-0" />
                    <span className="truncate">{data.guide_url}</span>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
                  </a>
                ) : (
                  <div className="px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-100 text-slate-400 italic text-sm">
                    Chưa có URL hướng dẫn.
                  </div>
                )}
              </div>

              {/* Guide Images */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1.5">
                    <ImagePlus className="w-3.5 h-3.5 text-violet-500" />
                    Hình ảnh chỉ dẫn ({data.guide_images.length})
                  </label>
                  {isEditing && (
                    <label className="cursor-pointer">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleUploadImage}
                        disabled={uploading}
                      />
                      <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${uploading ? 'bg-slate-100 text-slate-400 border-transparent' : 'bg-white text-violet-600 border-violet-200 hover:bg-violet-50 hover:border-violet-300'}`}>
                        {uploading ? (
                          <><Loader2 className="w-3 h-3 animate-spin" /> Đang tải...</>
                        ) : (
                          <><UploadCloud className="w-3.5 h-3.5" /> Thêm ảnh</>
                        )}
                      </div>
                    </label>
                  )}
                </div>

                {data.guide_images.length > 0 ? (
                  <div className="grid grid-cols-3 gap-3">
                    {data.guide_images.map((url, idx) => (
                      <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                        <img src={url} alt={`Guide ${idx + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                        {isEditing && (
                          <button
                            onClick={() => removeImage(url)}
                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-2 bg-red-500 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100 shadow-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        {!isEditing && (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                          >
                            <span className="bg-white/90 text-slate-700 text-xs font-semibold px-2 py-1 rounded-lg">Xem full</span>
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400">
                    <ImagePlus className="w-8 h-8 mb-2 opacity-40" />
                    <p className="text-xs font-medium">Chưa có hình ảnh chỉ dẫn nào.</p>
                    {isEditing && <p className="text-[11px] mt-1 text-slate-400">Bấm "Thêm ảnh" phía trên để tải lên.</p>}
                  </div>
                )}
              </div>

              {/* Empty state */}
              {!hasContent && !isEditing && (
                <div className="flex flex-col items-center text-center py-4 gap-2 text-slate-500">
                  <p className="text-sm font-medium">Hạng mục này chưa có hướng dẫn.</p>
                  <p className="text-xs text-slate-400">Bấm "Chỉnh sửa" để thêm nội dung.</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          {saved && (
            <span className="text-sm font-semibold text-emerald-600 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Đã lưu thành công!
            </span>
          )}
          {!saved && <span />}
          <div className="flex items-center gap-3 ml-auto">
            {isEditing ? (
              <>
                <button
                  onClick={() => { setIsEditing(false); fetchGuideLine(); }}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-colors disabled:opacity-60 shadow-sm"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Đang lưu...' : 'Lưu hướng dẫn'}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  Đóng
                </button>
                {!readOnly && <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-colors shadow-sm"
                >
                  <BookOpen className="w-4 h-4" />
                  Chỉnh sửa
                </button>}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
