"use client";

import { useMemo, useState, useTransition } from "react";
import {
  ChevronRight, ChevronDown, FolderTree, FolderOpen,
  Plus, Pencil, Trash2, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
} from "@/lib/actions/admin-categories";
import type { CategoryWithCounts } from "./page";

interface TreeNode extends CategoryWithCounts {
  children: TreeNode[];
}

function buildTree(flat: CategoryWithCounts[]): TreeNode[] {
  const map = new Map<string, TreeNode>(flat.map((c) => [c.id, { ...c, children: [] }]));
  const roots: TreeNode[] = [];
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export function CategoriesTree({ categories }: { categories: CategoryWithCounts[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [createOpen, setCreateOpen] = useState(false);
  const [createParent, setCreateParent] = useState<string | null>(null);
  const [editing, setEditing] = useState<CategoryWithCounts | null>(null);
  const [deleting, setDeleting] = useState<CategoryWithCounts | null>(null);

  // Reactive copy of categories (server invalidation will refetch on the next render)
  const tree = useMemo(() => buildTree(categories), [categories]);

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-muted-foreground">Click ▸ to expand subtrees.</p>
        <Button size="sm" onClick={() => { setCreateParent(null); setCreateOpen(true); }}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add root category
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="rounded-lg border bg-white">
        {tree.length === 0 ? (
          <p className="p-8 text-center text-muted-foreground text-sm">
            No categories yet. Click &quot;Add root category&quot; to begin.
          </p>
        ) : (
          <ul className="divide-y">
            {tree.map((node) => (
              <TreeNodeRow
                key={node.id}
                node={node}
                depth={0}
                onAddChild={(parentId) => { setCreateParent(parentId); setCreateOpen(true); }}
                onEdit={(c) => setEditing(c)}
                onDelete={(c) => setDeleting(c)}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Create dialog */}
      <CategoryDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={createParent ? "Add subcategory" : "Add root category"}
        initialName=""
        initialParentId={createParent}
        categories={categories}
        excludeId={null}
        onSubmit={async (data) => {
          setError(null);
          return new Promise((resolve) => {
            startTransition(async () => {
              const res = await createCategoryAction(data);
              if (res.ok) { setCreateOpen(false); resolve({ ok: true }); }
              else resolve({ ok: false, error: res.error });
            });
          });
        }}
        pending={pending}
      />

      {/* Edit dialog */}
      {editing && (
        <CategoryDialog
          open={!!editing}
          onClose={() => setEditing(null)}
          title="Edit category"
          initialName={editing.name}
          initialParentId={editing.parentId}
          categories={categories}
          excludeId={editing.id}
          onSubmit={async (data) => {
            setError(null);
            return new Promise((resolve) => {
              startTransition(async () => {
                const res = await updateCategoryAction(editing.id, data);
                if (res.ok) { setEditing(null); resolve({ ok: true }); }
                else resolve({ ok: false, error: res.error });
              });
            });
          }}
          pending={pending}
        />
      )}

      {/* Delete dialog */}
      {deleting && (
        <DeleteCategoryDialog
          category={deleting}
          allCategories={categories}
          onClose={() => setDeleting(null)}
          onConfirm={async (reassignToId) => {
            setError(null);
            return new Promise((resolve) => {
              startTransition(async () => {
                const res = await deleteCategoryAction(deleting.id, reassignToId);
                if (res.ok) { setDeleting(null); resolve({ ok: true }); }
                else resolve({ ok: false, error: res.error });
              });
            });
          }}
          pending={pending}
        />
      )}
    </>
  );
}

function TreeNodeRow({
  node, depth, onAddChild, onEdit, onDelete,
}: {
  node: TreeNode;
  depth: number;
  onAddChild: (parentId: string) => void;
  onEdit: (c: CategoryWithCounts) => void;
  onDelete: (c: CategoryWithCounts) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <li>
      <div
        className="flex items-center gap-2 px-3 py-2 hover:bg-muted/40"
        style={{ paddingLeft: `${depth * 24 + 12}px` }}
      >
        <button
          type="button"
          onClick={() => setExpanded((x) => !x)}
          disabled={!hasChildren}
          className="flex items-center justify-center w-5 h-5 text-muted-foreground"
        >
          {hasChildren ? (
            expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />
          ) : null}
        </button>

        {hasChildren ? (
          <FolderOpen className="h-4 w-4 text-blue-600 shrink-0" />
        ) : (
          <FolderTree className="h-4 w-4 text-muted-foreground shrink-0" />
        )}

        <span className="text-sm font-medium flex-1 truncate">{node.name}</span>

        <span className="text-xs text-muted-foreground font-mono">{node.slug}</span>

        <span
          className={`text-xs ${
            node.productCount > 0 ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          {node.productCount} item{node.productCount !== 1 ? "s" : ""}
        </span>

        <div className="flex items-center gap-1 ml-2">
          <Button size="sm" variant="ghost" onClick={() => onAddChild(node.id)} title="Add subcategory">
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onEdit(node)} title="Edit">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onDelete(node)} title="Delete" className="text-muted-foreground hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {expanded && hasChildren && (
        <ul className="border-l ml-6">
          {node.children.map((child) => (
            <TreeNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function CategoryDialog({
  open, onClose, title, initialName, initialParentId, categories, excludeId,
  onSubmit, pending,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  initialName: string;
  initialParentId: string | null;
  categories: CategoryWithCounts[];
  excludeId: string | null;
  onSubmit: (data: { name: string; parentId: string | null }) => Promise<{ ok: true } | { ok: false; error: string }>;
  pending: boolean;
}) {
  const [name, setName] = useState(initialName);
  const [parentId, setParentId] = useState<string>(initialParentId ?? "");
  const [error, setError] = useState<string | null>(null);

  // For edit mode: exclude self and descendants from parent options
  const validParents = useMemo(() => {
    if (!excludeId) return categories;
    const descendants = new Set<string>();
    const queue = [excludeId];
    while (queue.length) {
      const cur = queue.shift()!;
      descendants.add(cur);
      for (const c of categories) if (c.parentId === cur) queue.push(c.id);
    }
    return categories.filter((c) => !descendants.has(c.id));
  }, [categories, excludeId]);

  async function handleSubmit() {
    setError(null);
    if (!name.trim()) { setError("Name is required"); return; }
    const res = await onSubmit({ name: name.trim(), parentId: parentId || null });
    if (!res.ok) setError(res.error);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !pending) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cat-name">Name <span className="text-destructive">*</span></Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Engine parts"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-parent">Parent</Label>
            <select
              id="cat-parent"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">— Root —</option>
              {validParents.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteCategoryDialog({
  category, allCategories, onClose, onConfirm, pending,
}: {
  category: CategoryWithCounts;
  allCategories: CategoryWithCounts[];
  onClose: () => void;
  onConfirm: (reassignToId: string | null) => Promise<{ ok: true } | { ok: false; error: string }>;
  pending: boolean;
}) {
  const [reassignTo, setReassignTo] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const otherCategories = allCategories.filter((c) => c.id !== category.id);
  const needsReassign = category.productCount > 0;

  async function handleConfirm() {
    setError(null);
    if (needsReassign && !reassignTo) {
      setError("Pick a category to reassign products to.");
      return;
    }
    const res = await onConfirm(reassignTo || null);
    if (!res.ok) setError(res.error);
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v && !pending) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete &ldquo;{category.name}&rdquo;?</DialogTitle>
          <DialogDescription>
            {needsReassign ? (
              <>
                This category has <strong>{category.productCount} product{category.productCount !== 1 ? "s" : ""}</strong>.
                Pick a category to reassign them to before deletion.
              </>
            ) : (
              "This action cannot be undone."
            )}
          </DialogDescription>
        </DialogHeader>

        {needsReassign && (
          <div className="space-y-1.5">
            <Label>Reassign products to</Label>
            <select
              value={reassignTo}
              onChange={(e) => setReassignTo(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">— Pick a category —</option>
              {otherCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
