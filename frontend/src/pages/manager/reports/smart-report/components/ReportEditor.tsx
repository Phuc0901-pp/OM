import React, { useEffect, useState } from 'react';
import { useEditor, EditorContent, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Image } from '@tiptap/extension-image';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { TextStyle } from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import * as TiptapCore from '@tiptap/core';

import {
    Bold, Italic, Underline as UnderlineIcon, List,
    Table as TableIcon, Trash2, Plus, AlignLeft, AlignCenter,
    AlignRight, AlignJustify, Strikethrough, Redo, Undo,
    Heading1, Heading2, Type, Eraser, Highlighter, Palette,
    Superscript as SuperscriptIcon, Subscript as SubscriptIcon,
    Sigma, FileImage, Layout, Type as TypeIcon, ImagePlus, MousePointerClick,
    Indent as IndentIcon, Outdent as OutdentIcon, ArrowUpDown
} from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import 'katex/dist/katex.min.css';
import katex from 'katex';

// Debugging Tiptap Core exports
console.log('TiptapCore Exports:', TiptapCore);

// --- Custom Math Extension ---
const MathExtension = TiptapCore.Node.create({
    name: 'math',
    group: 'inline',
    inline: true,
    atom: true,
    addAttributes() {
        return {
            latex: {
                default: 'x',
            },
        };
    },
    parseHTML() {
        return [
            {
                tag: 'span[data-type="math"]',
            },
        ];
    },
    renderHTML({ HTMLAttributes }) {
        return ['span', TiptapCore.mergeAttributes(HTMLAttributes, { 'data-type': 'math' })];
    },
    addNodeView() {
        return ReactNodeViewRenderer(MathComponent);
    },
});

const MathComponent = ({ node, updateAttributes, selected }: any) => {
    const [isEditing, setIsEditing] = useState(false);
    const [latex, setLatex] = useState(node.attrs.latex);
    const htmlRef = React.useRef<HTMLSpanElement>(null);

    useEffect(() => {
        if (htmlRef.current) {
            try {
                katex.render(node.attrs.latex, htmlRef.current, {
                    throwOnError: false,
                    displayMode: false,
                });
            } catch (e: any) {
                htmlRef.current.innerText = e.message;
            }
        }
    }, [node.attrs.latex]);

    const submit = () => {
        updateAttributes({ latex });
        setIsEditing(false);
    };

    if (isEditing) {
        return (
            <NodeViewWrapper className="inline-block relative z-50">
                <div className="absolute top-full left-0 bg-white shadow-xl border border-indigo-100 p-3 rounded-lg z-50 flex gap-2 min-w-[250px] animate-fade-in">
                    <input
                        autoFocus
                        value={latex}
                        onChange={(e) => setLatex(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && submit()}
                        className="border border-slate-200 p-1.5 text-sm rounded bg-slate-50 flex-1 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        placeholder="e.g. E=mc^2"
                    />
                    <button onClick={submit} className="text-xs bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1 rounded transition-colors font-medium">OK</button>
                    <button onClick={() => setIsEditing(false)} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1 rounded transition-colors">Hủy</button>
                </div>
                <span className="bg-indigo-50 p-0.5 rounded text-indigo-800 font-mono text-xs border border-indigo-100">{latex}</span>
            </NodeViewWrapper>
        );
    }

    return (
        <NodeViewWrapper className={`inline-block cursor-pointer p-0.5 rounded transition-all ${selected ? 'bg-indigo-100 ring-2 ring-indigo-300' : 'hover:bg-indigo-50'}`} onClick={() => setIsEditing(true)}>
            <span ref={htmlRef} />
        </NodeViewWrapper>
    );
};

// --- Custom Font Size Extension ---
const FontSize = TiptapCore.Mark.create({
    name: 'fontSize',

    addOptions() {
        return {
            HTMLAttributes: {},
        };
    },

    addAttributes() {
        return {
            size: {
                default: null,
                parseHTML: element => element.style.fontSize?.replace(/['"]+/g, ''),
                renderHTML: attributes => {
                    if (!attributes.size) {
                        return {};
                    }
                    return {
                        style: `font-size: ${attributes.size} !important`,
                    };
                },
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'span',
                getAttrs: (element) => {
                    const hasFontSize = (element as HTMLElement).style.fontSize;
                    return hasFontSize ? {} : false;
                },
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['span', TiptapCore.mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
    },

    addCommands() {
        return {
            setFontSize: (size: string) => ({ chain }: any) => {
                return chain()
                    .setMark('fontSize', { size })
                    .run();
            },
            unsetFontSize: () => ({ chain }: any) => {
                return chain()
                    .unsetMark('fontSize')
                    .run();
            },
        };
    },
});

// --- Custom Line Height Extension ---
const LineHeight = TiptapCore.Extension.create({
    name: 'lineHeight',
    addOptions() { return { types: ['paragraph', 'heading'] }; },
    addGlobalAttributes() {
        return [{
            types: this.options.types,
            attributes: {
                lineHeight: {
                    default: null,
                    parseHTML: element => element.style.lineHeight || null,
                    renderHTML: attributes => {
                        if (!attributes.lineHeight) return {};
                        return { style: `line-height: ${attributes.lineHeight}` };
                    },
                },
            },
        }];
    },
    addCommands() {
        return {
            setLineHeight: (lineHeight: string) => ({ commands }: any) => {
                return this.options.types.every((type: string) => commands.updateAttributes(type, { lineHeight }));
            },
            unsetLineHeight: () => ({ commands }: any) => {
                return this.options.types.every((type: string) => commands.resetAttributes(type, 'lineHeight'));
            },
        };
    },
});

// --- Custom Indent Extension ---
declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        indent: {
            indent: () => ReturnType;
            outdent: () => ReturnType;
        };
        lineHeight: {
            setLineHeight: (lineHeight: string) => ReturnType;
            unsetLineHeight: () => ReturnType;
        };
        fontSize: {
            setFontSize: (size: string) => ReturnType;
            unsetFontSize: () => ReturnType;
        };
    }
}

const Indent = TiptapCore.Extension.create({
    name: 'indent',
    addOptions() { return { types: ['paragraph', 'heading', 'bulletList', 'orderedList'], minIndent: 0, maxIndent: 210 }; },
    addGlobalAttributes() {
        return [{
            types: this.options.types,
            attributes: {
                indent: {
                    default: 0,
                    parseHTML: element => {
                        const marginLeft = element.style.marginLeft;
                        return marginLeft ? parseInt(marginLeft, 10) : 0;
                    },
                    renderHTML: attributes => {
                        if (attributes.indent === 0) return {};
                        return { style: `margin-left: ${attributes.indent}px` };
                    },
                },
            },
        }];
    },
    addCommands() {
        return {
            indent: () => ({ tr, state, dispatch }) => {
                const { selection } = state;
                const { from, to } = selection;
                let applicable = false;

                state.doc.nodesBetween(from, to, (node) => {
                    if (this.options.types.includes(node.type.name)) applicable = true;
                });

                if (!applicable) return false;

                if (dispatch) {
                    state.doc.nodesBetween(from, to, (node, pos) => {
                        if (this.options.types.includes(node.type.name)) {
                            const currentIndent = node.attrs.indent || 0;
                            const newIndent = Math.min(currentIndent + 30, this.options.maxIndent);
                            tr.setNodeMarkup(pos, null, { ...node.attrs, indent: newIndent });
                        }
                    });
                }
                return true;
            },
            outdent: () => ({ tr, state, dispatch }) => {
                const { selection } = state;
                const { from, to } = selection;
                let applicable = false;

                state.doc.nodesBetween(from, to, (node) => {
                    if (this.options.types.includes(node.type.name)) applicable = true;
                });

                if (!applicable) return false;

                if (dispatch) {
                    state.doc.nodesBetween(from, to, (node, pos) => {
                        if (this.options.types.includes(node.type.name)) {
                            const currentIndent = node.attrs.indent || 0;
                            const newIndent = Math.max(currentIndent - 30, this.options.minIndent);
                            tr.setNodeMarkup(pos, null, { ...node.attrs, indent: newIndent });
                        }
                    });
                }
                return true;
            },
        };
    },
    addKeyboardShortcuts() {
        return {
            'Tab': () => this.editor.commands.indent(),
            'Shift-Tab': () => this.editor.commands.outdent(),
        }
    }
});

interface Props {
    content?: string;
    onUpdate?: (content: string) => void;
    droppedImage?: any | null;
    onImageHandled?: () => void;
}

const MenuBar = ({ editor }: { editor: any }) => {
    if (!editor) return null;
    const [activeTab, setActiveTab] = useState<'home' | 'insert' | 'layout'>('home');
    const [, forceUpdate] = useState(0);

    useEffect(() => {
        if (!editor) return;
        const updateHandler = () => forceUpdate((n) => n + 1);

        // Listen to all relevant events to ensure UI stays in sync (especially for stored marks like Font/Size)
        editor.on('transaction', updateHandler);
        editor.on('selectionUpdate', updateHandler);
        editor.on('update', updateHandler);

        return () => {
            editor.off('transaction', updateHandler);
            editor.off('selectionUpdate', updateHandler);
            editor.off('update', updateHandler);
        };
    }, [editor]);

    const Button = ({ onClick, isActive = false, disabled = false, title, children, className }: any) => (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`
                p-1.5 rounded-lg transition-all flex flex-col items-center justify-center gap-1 min-w-[36px] h-full
                ${isActive
                    ? 'bg-indigo-50 text-indigo-600 shadow-sm ring-1 ring-indigo-200'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                ${disabled ? 'opacity-40 cursor-not-allowed contrast-50' : 'cursor-pointer'}
                ${className || ''}
            `}
            title={title}
        >
            {children}
        </button>
    );

    const Group = ({ label, children }: any) => (
        <div className="flex flex-col items-center px-3 border-r border-slate-100 last:border-0 h-full justify-between py-1">
            <div className="flex items-center gap-1 h-full">{children}</div>
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{label}</span>
        </div>
    );

    const fontSizes = ['12px', '14px', '16px', '18px', '20px', '24px', '30px', '36px', '48px', '60px', '72px'];

    return (
        <div className="flex flex-col border-b border-slate-200 bg-white sticky top-0 z-20 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)]">
            {/* Ribbon Tabs */}
            <div className="flex items-center gap-1 px-4 pt-2 bg-slate-50/50 border-b border-slate-200">
                {['Trang chủ', 'Chèn', 'Bố cục'].map((tab) => {
                    const tabKey = tab === 'Trang chủ' ? 'home' : tab === 'Chèn' ? 'insert' : 'layout';
                    const isActive = activeTab === tabKey;
                    return (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tabKey as any)}
                            className={`
                                px-5 py-2 text-xs font-semibold rounded-t-lg transition-all relative top-[1px] select-none
                                ${isActive
                                    ? 'bg-white text-indigo-600 border-x border-t border-slate-200 border-b-white shadow-sm z-10'
                                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 border-transparent'}
                            `}
                        >
                            {tab}
                        </button>
                    );
                })}
            </div>

            {/* Ribbon Content */}
            <div className="flex items-start p-2 gap-2 h-24 overflow-x-auto custom-scrollbar bg-white">
                {activeTab === 'home' && (
                    <>
                        <Group label="Lịch sử">
                            <Button onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Hoàn tác">
                                <Undo className="w-5 h-5" />
                            </Button>
                            <Button onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Làm lại">
                                <Redo className="w-5 h-5" />
                            </Button>
                        </Group>

                        <Group label="Định dạng">
                            <div className="flex flex-col gap-2 h-full justify-center">
                                <div className="flex gap-2 items-center">
                                    <select
                                        className="text-xs border border-slate-200 rounded-md p-1 w-32 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 hover:bg-white transition-colors"
                                        onChange={(e) => editor.chain().focus().setFontFamily(e.target.value).run()}
                                        value={editor.getAttributes('textStyle').fontFamily?.replace(/['"]+/g, '') || ''}
                                    >
                                        <option value="" disabled>Chọn Font</option>
                                        <option value="Inter">Inter</option>
                                        <option value="Arial">Arial</option>
                                        <option value="Times New Roman">Times New Roman</option>
                                        <option value="Courier New">Courier New</option>
                                        <option value="Georgia">Georgia</option>
                                    </select>

                                    <select
                                        className="text-xs border border-slate-200 rounded-md p-1 w-20 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 hover:bg-white transition-colors"
                                        onChange={(e) => editor.chain().focus().setFontSize(e.target.value).run()}
                                        value={editor.getAttributes('fontSize').size || ''}
                                    >
                                        <option value="" disabled>Size</option>
                                        {fontSizes.map((size) => (
                                            <option key={size} value={size}>{size}</option>
                                        ))}
                                    </select>

                                    <div className="h-4 w-px bg-slate-200 mx-1"></div>

                                    <div className="flex items-center gap-1 bg-slate-50 rounded-md p-1 border border-slate-100">
                                        <div className="flex flex-col items-center justify-center gap-0.5 relative cursor-pointer px-1 py-0.5 rounded hover:bg-slate-200 transition-colors w-8 h-full" title="Màu chữ">
                                            <span className="text-[12px] leading-none font-bold text-slate-600">A</span>
                                            <div className="w-full h-1 border border-slate-300 rounded-sm overflow-hidden relative">
                                                <div
                                                    className="w-full h-full absolute top-0 left-0 transition-colors duration-200"
                                                    style={{ backgroundColor: editor.getAttributes('textStyle').color || '#000000' }}
                                                ></div>
                                            </div>
                                            <input
                                                type="color"
                                                onChange={(e: any) => editor.chain().focus().setColor(e.target.value).run()}
                                                value={editor.getAttributes('textStyle').color || '#000000'}
                                                className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10"
                                            />
                                        </div>

                                        <div className="w-px h-4 bg-slate-200"></div>

                                        <div className="flex flex-col items-center justify-center gap-0.5 relative cursor-pointer px-1 py-0.5 rounded hover:bg-slate-200 transition-colors w-8 h-full" title="Màu nền (Highlight)">
                                            <Highlighter className="w-3.5 h-3.5 text-slate-600" />
                                            <div className="w-full h-1 border border-slate-300 rounded-sm overflow-hidden relative">
                                                <div
                                                    className="w-full h-full absolute top-0 left-0 transition-colors duration-200"
                                                    style={{ backgroundColor: editor.getAttributes('highlight').color || '#ffffff' }}
                                                ></div>
                                            </div>
                                            <input
                                                type="color"
                                                onChange={(e: any) => editor.chain().focus().setHighlight({ color: e.target.value }).run()}
                                                value={editor.getAttributes('highlight').color || '#ffffff'}
                                                className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10"
                                            />
                                        </div>

                                        <Button
                                            onClick={() => editor.chain().focus().unsetHighlight().run()}
                                            disabled={!editor.isActive('highlight')}
                                            title="Xóa Highlight"
                                            className="!p-0.5 !min-w-[16px] !h-5 ml-0.5 text-slate-400 hover:text-red-500 hover:bg-red-50"
                                        >
                                            <div className="text-[10px] leading-none">✕</div>
                                        </Button>
                                    </div>
                                </div>
                                <div className="flex gap-0.5">
                                    <Button onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} title="In đậm">
                                        <Bold className="w-4 h-4" />
                                    </Button>
                                    <Button onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} title="In nghiêng">
                                        <Italic className="w-4 h-4" />
                                    </Button>
                                    <Button onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} title="Gạch chân">
                                        <UnderlineIcon className="w-4 h-4" />
                                    </Button>
                                    <Button onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')} title="Gạch ngang">
                                        <Strikethrough className="w-4 h-4" />
                                    </Button>
                                    <div className="h-4 w-px bg-slate-200 mx-1"></div>
                                    <Button onClick={() => editor.chain().focus().toggleSubscript().run()} isActive={editor.isActive('subscript')} title="Chỉ số dưới">
                                        <SubscriptIcon className="w-4 h-4" />
                                    </Button>
                                    <Button onClick={() => editor.chain().focus().toggleSuperscript().run()} isActive={editor.isActive('superscript')} title="Chỉ số trên">
                                        <SuperscriptIcon className="w-4 h-4" />
                                    </Button>
                                    <Button onClick={() => editor.chain().focus().unsetAllMarks().run()} title="Xóa định dạng" className="text-red-500 hover:bg-red-50">
                                        <Eraser className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        </Group>

                        <Group label="Đoạn văn">
                            <div className="flex flex-col gap-2 justify-center h-full">
                                <div className="flex gap-0.5 bg-slate-50 p-1 rounded-md border border-slate-100">
                                    <Button onClick={() => editor.chain().focus().setTextAlign('left').run()} isActive={editor.isActive({ textAlign: 'left' })} title="Căn trái" className="!h-6 !min-w-[28px] !p-0.5">
                                        <AlignLeft className="w-4 h-4" />
                                    </Button>
                                    <Button onClick={() => editor.chain().focus().setTextAlign('center').run()} isActive={editor.isActive({ textAlign: 'center' })} title="Căn giữa" className="!h-6 !min-w-[28px] !p-0.5">
                                        <AlignCenter className="w-4 h-4" />
                                    </Button>
                                    <Button onClick={() => editor.chain().focus().setTextAlign('right').run()} isActive={editor.isActive({ textAlign: 'right' })} title="Căn phải" className="!h-6 !min-w-[28px] !p-0.5">
                                        <AlignRight className="w-4 h-4" />
                                    </Button>
                                    <Button onClick={() => editor.chain().focus().setTextAlign('justify').run()} isActive={editor.isActive({ textAlign: 'justify' })} title="Căn đều" className="!h-6 !min-w-[28px] !p-0.5">
                                        <AlignJustify className="w-4 h-4" />
                                    </Button>
                                </div>
                                <div className="flex gap-1 justify-between items-center px-1">
                                    <div className="flex gap-0.5">
                                        <Button onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} title="Danh sách">
                                            <List className="w-4 h-4" />
                                        </Button>
                                        <Button onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} title="Danh sách số">
                                            <List className="w-4 h-4" />{/* TODO: Use Ordered List Icon */}
                                            <span className="text-[10px] font-bold absolute bottom-0.5 right-0.5">1.</span>
                                        </Button>
                                    </div>

                                    <div className="w-px h-4 bg-slate-200"></div>

                                    <div className="flex gap-0.5">
                                        <Button onClick={() => (editor.chain().focus() as any).outdent().run()} title="Giảm thụt lề (Shift+Tab)">
                                            <OutdentIcon className="w-4 h-4" />
                                        </Button>
                                        <Button onClick={() => (editor.chain().focus() as any).indent().run()} title="Tăng thụt lề (Tab)">
                                            <IndentIcon className="w-4 h-4" />
                                        </Button>
                                    </div>

                                    <div className="w-px h-4 bg-slate-200"></div>

                                    <div className="relative group" title="Khoảng cách dòng">
                                        <button className="p-1 rounded hover:bg-slate-100 flex items-center gap-1 text-xs font-medium text-slate-600">
                                            <ArrowUpDown className="w-3.5 h-3.5" />
                                            {editor.getAttributes('paragraph').lineHeight || '1.0'}
                                        </button>
                                        <div className="absolute top-full left-0 bg-white border border-slate-200 shadow-lg rounded-md p-1 z-50 hidden group-hover:flex flex-col min-w-[60px]">
                                            {['1.0', '1.15', '1.5', '2.0', '2.5', '3.0'].map(lh => (
                                                <button
                                                    key={lh}
                                                    onClick={() => (editor.chain().focus() as any).setLineHeight(lh).run()}
                                                    className={`text-left px-2 py-1 text-xs hover:bg-slate-100 rounded ${editor.getAttributes('paragraph').lineHeight === lh ? 'bg-indigo-50 text-indigo-600 font-bold' : ''}`}
                                                >
                                                    {lh}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Group>

                        <Group label="Kiểu Style">
                            <select
                                className="text-xs border border-slate-200 rounded-md p-1.5 w-36 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === 'p') editor.chain().focus().setParagraph().run();
                                    else editor.chain().focus().toggleHeading({ level: parseInt(val) as any }).run();
                                }}
                                value={editor.isActive('heading', { level: 1 }) ? '1' : editor.isActive('heading', { level: 2 }) ? '2' : editor.isActive('heading', { level: 3 }) ? '3' : 'p'}
                            >
                                <option value="p">Normal (Thường)</option>
                                <option value="1">Heading 1 (Lớn)</option>
                                <option value="2">Heading 2 (Vừa)</option>
                                <option value="3">Heading 3 (Nhỏ)</option>
                            </select>
                        </Group>
                    </>
                )}

                {activeTab === 'insert' && (
                    <>
                        <Group label="Bảng">
                            <Button
                                onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                                title="Chèn bảng nhanh (3x3)"
                                className="px-5 h-[80%]"
                            >
                                <TableIcon className="w-6 h-6 text-indigo-600 mb-1" />
                                <span className="text-xs font-medium">Chèn Bảng</span>
                            </Button>
                        </Group>
                        <Group label="Khoa học">
                            <Button
                                onClick={() => {
                                    editor.chain().focus().insertContent({ type: 'math', attrs: { latex: 'E=mc^2' } }).run();
                                }}
                                title="Chèn công thức toán (LaTeX)"
                                className="px-5 h-[80%]"
                            >
                                <Sigma className="w-6 h-6 text-indigo-600 mb-1" />
                                <span className="text-xs font-medium">Công thức</span>
                            </Button>
                        </Group>
                        <Group label="Media">
                            <Button
                                title="Chèn ảnh (Kéo thả từ thư viện bên phải)"
                                disabled
                                className="px-5 h-[80%] opacity-100"
                            >
                                <ImagePlus className="w-6 h-6 text-slate-400 mb-1" />
                                <span className="text-xs text-slate-500 font-medium">Chèn Ảnh (Kéo thả)</span>
                            </Button>
                        </Group>
                    </>
                )}

                {activeTab === 'layout' && (
                    <>
                        <Group label="Hàng & Cột">
                            <div className="grid grid-cols-2 gap-1 h-full">
                                <Button onClick={() => editor.chain().focus().addColumnAfter().run()} disabled={!editor.can().addColumnAfter()} title="Thêm cột phải" className="!flex-row !justify-start !w-24 px-2">
                                    <Plus className="w-3.5 h-3.5 rotate-90" /> <span className="text-xs">Thêm Cột</span>
                                </Button>
                                <Button onClick={() => editor.chain().focus().deleteColumn().run()} disabled={!editor.can().deleteColumn()} title="Xóa cột" className="!flex-row !justify-start !w-24 px-2 text-red-600 hover:bg-red-50">
                                    <Trash2 className="w-3.5 h-3.5" /> <span className="text-xs">Xóa Cột</span>
                                </Button>
                                <Button onClick={() => editor.chain().focus().addRowAfter().run()} disabled={!editor.can().addRowAfter()} title="Thêm hàng dưới" className="!flex-row !justify-start !w-24 px-2">
                                    <Plus className="w-3.5 h-3.5" /> <span className="text-xs">Thêm Hàng</span>
                                </Button>
                                <Button onClick={() => editor.chain().focus().deleteRow().run()} disabled={!editor.can().deleteRow()} title="Xóa hàng" className="!flex-row !justify-start !w-24 px-2 text-red-600 hover:bg-red-50">
                                    <Trash2 className="w-3.5 h-3.5" /> <span className="text-xs">Xóa Hàng</span>
                                </Button>
                            </div>
                        </Group>
                        <Group label="Toàn bộ bảng">
                            <Button onClick={() => editor.chain().focus().deleteTable().run()} disabled={!editor.can().deleteTable()} title="Xóa bảng" className="text-red-600 h-[80%] px-4">
                                <Trash2 className="w-6 h-6 mb-1" />
                                <span className="text-xs font-medium">Xóa Bảng</span>
                            </Button>
                        </Group>
                    </>
                )}
            </div>
        </div>
    );
};

const ReportEditor: React.FC<Props> = ({ content, onUpdate, droppedImage, onImageHandled }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: 'editor-zone',
    });

    const editor = useEditor({
        extensions: [
            StarterKit,
            Underline,
            TextStyle,
            FontFamily,
            FontSize, // Added custom extension
            Color,
            Highlight.configure({ multicolor: true }),
            Subscript,
            Superscript,
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
            Placeholder.configure({
                placeholder: 'Nhập nội dung báo cáo hoặc kéo thả ảnh vào đây...',
            }),
            Table.configure({
                resizable: true,
                HTMLAttributes: {
                    class: 'border-collapse table-fixed w-full my-4 border border-slate-300',
                },
            }),
            TableRow,
            TableHeader.configure({
                HTMLAttributes: {
                    class: 'border border-slate-300 bg-slate-100 p-2 text-left font-bold',
                },
            }),
            TableCell.configure({
                HTMLAttributes: {
                    class: 'border border-slate-300 p-2',
                },
            }),
            Image.configure({
                inline: true,
                allowBase64: true,
                HTMLAttributes: {
                    class: 'rounded-lg max-w-full h-auto shadow-md',
                }
            }),
            MathExtension,
            Indent,
            LineHeight,
        ],
        content: content || '',
        onUpdate: ({ editor }) => {
            if (onUpdate) {
                onUpdate(editor.getHTML());
            }
        },
    });

    useEffect(() => {
        if (droppedImage && editor) {
            editor.chain().focus().setImage({ src: droppedImage.url, alt: droppedImage.name }).run();
            if (onImageHandled) onImageHandled();
        }
    }, [droppedImage, editor, onImageHandled]);

    return (
        <div className="flex flex-col h-full bg-slate-100 overflow-hidden relative">
            <MenuBar editor={editor} />

            <div className="flex-1 overflow-auto p-8 justify-center flex custom-scrollbar" ref={setNodeRef}>
                <div className={`
                    bg-white shadow-[0_0_40px_-10px_rgba(0,0,0,0.1)] w-[210mm] min-h-[297mm] p-[20mm] box-border transition-all
                    ${isOver ? 'ring-4 ring-indigo-200 bg-indigo-50/30' : ''}
                    prose prose-sm max-w-none
                    prose-headings:font-display prose-headings:text-slate-800
                    prose-p:text-slate-700 prose-p:leading-relaxed
                    prose-a:text-indigo-600 prose-a:no-underline hover:prose-a:underline
                    prose-strong:font-bold prose-strong:text-slate-900
                    prose-code:text-indigo-600 prose-code:bg-indigo-50 prose-code:px-1 prose-code:rounded
                    prose-table:border prose-table:border-slate-200 prose-active:none focus:outline-none
                `}>
                    <EditorContent editor={editor} className="outline-none h-full" />
                </div>
            </div>
        </div>
    );
};

export default ReportEditor;
