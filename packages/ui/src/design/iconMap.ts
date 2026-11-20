import {
  Plus, Trash2, Search, RotateCcw, Settings, Pencil, Star, Copy, FileText, Upload, Download, Table, Columns3, CloudUpload, Bell, Calendar,
  Square, SquareCheck, Network, ChevronRight, ChevronDown, Ellipsis, TriangleAlert, CircleAlert, CircleCheck, Info, X, PanelLeft, Inbox, Undo2,
  LoaderCircle, Tag, Clock, Link, Image, File, Folder, GripVertical, Lightbulb, Check, List, ZoomIn, ZoomOut, Maximize, Grid3x3, Maximize2, Minimize2, Redo2, Magnet, CornerDownRight, ListTree, ChevronsDownUp, ChevronsUpDown, Workflow, Smile, ClipboardCopy, ClipboardPaste, StickyNote, Lock, ListFilter,
} from "lucide-react";

/** Mapa ÚNICO significado → ícono (plan 5). Un significado = un ícono; si cambia el significado, es un defecto. Solo este archivo importa la biblioteca. */
export const iconMap = {
  create: Plus, delete: Trash2, search: Search, restore: RotateCcw, settings: Settings, edit: Pencil, favorite: Star, duplicate: Copy,
  note: FileText, export: Upload, import: Download, database: Table, board: Columns3, backup: CloudUpload, reminder: Bell, calendar: Calendar,
  task: Square, taskDone: SquareCheck, graph: Network, collapse: ChevronDown, expand: ChevronRight, more: Ellipsis,
  warning: TriangleAlert, error: CircleAlert, success: CircleCheck, info: Info, close: X, sidebar: PanelLeft, inbox: Inbox, undo: Undo2,
  loading: LoaderCircle, tag: Tag, time: Clock, link: Link, image: Image, file: File, folder: Folder, drag: GripVertical, tip: Lightbulb, check: Check, toc: List, zoomIn: ZoomIn, zoomOut: ZoomOut, fitView: Maximize, grid: Grid3x3, fullscreen: Maximize2, exitFullscreen: Minimize2, redo: Redo2, snap: Magnet,
  addChild: CornerDownRight, applyBranch: ListTree, fold: ChevronsDownUp, unfold: ChevronsUpDown, reflow: Workflow,
  emoji: Smile, copy: ClipboardCopy, paste: ClipboardPaste, stickyNote: StickyNote, lock: Lock, filter: ListFilter,
} as const;

export type IconName = keyof typeof iconMap;
