import React from "react";
import type { Todo } from "../lib/types";
import "./TodoItem.css";

type TodoItemProps = {
  todo: Todo;
  onToggle: () => void;
  onDelete: () => void;
};

export function TodoItem({ todo, onToggle, onDelete }: TodoItemProps) {
  return (
    <div
      onClick={onToggle}
      className={`todo-item group ${todo.done ? "todo-item--done" : ""}`}
    >
      <div className="todo-item__checkbox">
        {todo.done && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path
              d="M1 4L3.5 6.5L9 1"
              stroke="#090f10"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      <span className="todo-item__text">{todo.text}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="todo-item__delete"
        aria-label="Delete task"
      >
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <path
            d="M2 2L11 11M11 2L2 11"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
