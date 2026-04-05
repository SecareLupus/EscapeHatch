"use client";

import type { Category } from "@skerry/shared";

interface CategoryModalsProps {
  activeModal: string | null;
  categoryName: string;
  setCategoryName: (name: string) => void;
  renameCategoryId: string;
  renameCategoryName: string;
  categories: Category[];
  mutatingStructure: boolean;
  handleCreateCategory: (e: React.FormEvent) => Promise<void>;
  handleRenameCategory: (e: React.FormEvent) => Promise<void>;
  handleDeleteCategory: (id: string) => Promise<void>;
  moveCategoryPosition: (id: string, direction: "up" | "down") => Promise<void>;
  dispatch: (action: any) => void;
  showToast: (message: string, type: "success" | "error") => void;
}

export function CategoryModals({
  activeModal,
  categoryName,
  setCategoryName,
  renameCategoryId,
  renameCategoryName,
  categories,
  mutatingStructure,
  handleCreateCategory,
  handleRenameCategory,
  handleDeleteCategory,
  moveCategoryPosition,
  dispatch,
  showToast
}: CategoryModalsProps) {
  if (activeModal === "create-category") {
    return (
      <form className="constrained-stack" onSubmit={(event) => {
        void handleCreateCategory(event);
        dispatch({ type: "SET_ACTIVE_MODAL", payload: null });
      }}>
        <label htmlFor="category-name-modal">Category Name</label>
        <input
          id="category-name-modal"
          autoFocus
          value={categoryName}
          onChange={(e) => setCategoryName(e.target.value)}
          minLength={2}
          maxLength={80}
          required
        />
        <button type="submit" disabled={mutatingStructure}>Create Category</button>
      </form>
    );
  }

  if (activeModal === "rename-category") {
    return (
      <div className="constrained-stack">
        <form className="constrained-stack" onSubmit={(event) => {
          void handleRenameCategory(event);
          dispatch({ type: "SET_ACTIVE_MODAL", payload: null });
        }}>
          <p>Editing category: <strong>{categories.find(c => c.id === renameCategoryId)?.name}</strong></p>
          <label htmlFor="rename-category-modal">Category Name</label>
          <input
            id="rename-category-modal"
            autoFocus
            value={renameCategoryName}
            onChange={(e) => dispatch({ type: "SET_RENAME_CATEGORY", payload: { id: renameCategoryId, name: e.target.value } })}
            minLength={2}
            maxLength={80}
            required
          />
          <button type="submit" disabled={mutatingStructure}>Save Name</button>
        </form>

        <div className="constrained-stack" style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
          <p>Reorder Category</p>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              disabled={mutatingStructure || categories.findIndex(c => c.id === renameCategoryId) === 0}
              onClick={() => moveCategoryPosition(renameCategoryId, "up")}
            >
              Move Up
            </button>
            <button
              type="button"
              disabled={mutatingStructure || categories.findIndex(c => c.id === renameCategoryId) === categories.length - 1}
              onClick={() => moveCategoryPosition(renameCategoryId, "down")}
            >
              Move Down
            </button>
          </div>
        </div>

        <div className="constrained-stack" style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
          <p>Danger Zone</p>
          <button
            type="button"
            className="danger"
            disabled={mutatingStructure}
            onClick={() => {
              const isMasquerade = !!sessionStorage.getItem("masquerade_token");
              if (isMasquerade) {
                  showToast("Masquerade: Category deletion blocked.", "error");
                  return;
              }

              const cat = categories.find(c => c.id === renameCategoryId);
              if (confirm(`Are you sure you want to delete the category "${cat?.name}"? Rooms inside will become uncategorized.`)) {
                void handleDeleteCategory(renameCategoryId);
                dispatch({ type: "SET_ACTIVE_MODAL", payload: null });
              }
            }}
          >
            Delete Category
          </button>
        </div>
      </div>
    );
  }

  return null;
}
