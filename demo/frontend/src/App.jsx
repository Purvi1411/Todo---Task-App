import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE = 'http://localhost:8080/tasks';

// ── Toast Notification Component ──
function Toast({ message, type, onExit }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const exitTimer = setTimeout(() => {
      setExiting(true);
      setTimeout(onExit, 200);
    }, 3000);
    return () => clearTimeout(exitTimer);
  }, [onExit]);

  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };

  return (
    <div className={`toast ${type} ${exiting ? 'exiting' : ''}`}>
      <span className="toast-icon">{icons[type] || icons.info}</span>
      {message}
    </div>
  );
}

// ── Progress Ring Component ──
function ProgressRing({ total, done }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="progress-section">
      <div className="progress-card">
        <div className="progress-ring">
          <svg width="64" height="64" viewBox="0 0 64 64">
            <defs>
              <linearGradient id="ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
            </defs>
            <circle cx="32" cy="32" r={radius} className="ring-bg" />
            <circle
              cx="32" cy="32" r={radius}
              className="ring-fill"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="progress-percent">{pct}%</div>
        </div>
        <div className="progress-info">
          <h3>Task Progress</h3>
          <p>{done} of {total} tasks completed</p>
        </div>
      </div>
    </div>
  );
}

// ── Task Card Component ──
function TaskCard({ task, onToggle, onDelete, onUpdate, style }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(task.title);
  const [isExiting, setIsExiting] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDelete = () => {
    setIsExiting(true);
    setTimeout(() => onDelete(task.id), 200);
  };

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== task.title) {
      onUpdate(task.id, { ...task, title: trimmed });
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setEditValue(task.title);
      setIsEditing(false);
    }
  };

  return (
    <div
      className={`task-card ${task.completed ? 'completed' : ''} ${isExiting ? 'exiting' : ''}`}
      style={style}
      role="listitem"
    >
      {/* Checkbox */}
      <button
        className={`task-checkbox ${task.completed ? 'checked' : ''}`}
        onClick={() => onToggle(task)}
        aria-label={task.completed ? 'Mark as pending' : 'Mark as done'}
        title={task.completed ? 'Mark as pending' : 'Mark as done'}
      >
        <span className="check-icon">✓</span>
      </button>

      {/* Content */}
      <div className="task-content">
        {isEditing ? (
          <input
            ref={inputRef}
            className="task-edit-input"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            aria-label="Edit task title"
            id={`task-edit-${task.id}`}
          />
        ) : (
          <>
            <div className="task-title">{task.title}</div>
            <div className="task-meta">
              <span className={`task-status-badge ${task.completed ? 'done' : 'pending'}`}>
                {task.completed ? '● Done' : '● Pending'}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="task-actions">
        {isEditing ? (
          <>
            <button
              className="btn-icon-action save"
              onClick={handleSave}
              aria-label="Save changes"
              title="Save"
              id={`task-save-${task.id}`}
            >💾</button>
            <button
              className="btn-icon-action cancel"
              onClick={() => { setEditValue(task.title); setIsEditing(false); }}
              aria-label="Cancel editing"
              title="Cancel"
              id={`task-cancel-${task.id}`}
            >✕</button>
          </>
        ) : (
          <>
            <button
              className="btn-icon-action edit"
              onClick={() => setIsEditing(true)}
              aria-label="Edit task"
              title="Edit"
              id={`task-edit-btn-${task.id}`}
            >✏️</button>
            <button
              className="btn-icon-action delete"
              onClick={handleDelete}
              aria-label="Delete task"
              title="Delete"
              id={`task-delete-${task.id}`}
            >🗑️</button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Skeleton Loader ──
function SkeletonList() {
  return (
    <div className="task-list">
      {[1, 2, 3].map(i => (
        <div key={i} className="skeleton-card" />
      ))}
    </div>
  );
}

// ── Main App ──
export default function App() {
  const [tasks, setTasks] = useState([]);
  const [newTitle, setNewTitle] = useState('');
  const [filter, setFilter] = useState('all'); // all | pending | done
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);

  // ── Toast helper ──
  const addToast = useCallback((message, type = 'success') => {
    const id = ++toastId.current;
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ── Fetch tasks ──
  const fetchTasks = useCallback(async () => {
    try {
      const { data } = await axios.get(API_BASE);
      setTasks(data);
      setError(null);
    } catch (err) {
      setError('Failed to load tasks. Is the Spring Boot server running?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // ── Create task ──
  const handleCreate = async (e) => {
    e.preventDefault();
    const trimmed = newTitle.trim();
    if (!trimmed) return;

    setSubmitting(true);
    try {
      const { data } = await axios.post(API_BASE, { title: trimmed, completed: false });
      setTasks(prev => [...prev, data]);
      setNewTitle('');
      addToast('Task added successfully!', 'success');
    } catch {
      addToast('Failed to add task.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Toggle task ──
  const handleToggle = useCallback(async (task) => {
    const updated = { ...task, completed: !task.completed };
    setTasks(prev => prev.map(t => t.id === task.id ? updated : t));
    try {
      await axios.put(`${API_BASE}/${task.id}`, updated);
      addToast(
        updated.completed ? 'Task marked as done! 🎉' : 'Task moved to pending.',
        'success'
      );
    } catch {
      setTasks(prev => prev.map(t => t.id === task.id ? task : t));
      addToast('Failed to update task.', 'error');
    }
  }, [addToast]);

  // ── Delete task ──
  const handleDelete = useCallback(async (id) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    try {
      await axios.delete(`${API_BASE}/${id}`);
      addToast('Task deleted.', 'info');
    } catch {
      fetchTasks();
      addToast('Failed to delete task.', 'error');
    }
  }, [addToast, fetchTasks]);

  // ── Update task ──
  const handleUpdate = useCallback(async (id, updated) => {
    setTasks(prev => prev.map(t => t.id === id ? updated : t));
    try {
      await axios.put(`${API_BASE}/${id}`, updated);
      addToast('Task updated!', 'success');
    } catch {
      fetchTasks();
      addToast('Failed to update task.', 'error');
    }
  }, [addToast, fetchTasks]);

  // ── Derived stats ──
  const doneCount = tasks.filter(t => t.completed).length;
  const pendingCount = tasks.filter(t => !t.completed).length;

  // ── Filtered tasks ──
  const filteredTasks = tasks.filter(t => {
    if (filter === 'done') return t.completed;
    if (filter === 'pending') return !t.completed;
    return true;
  });

  // ── Empty state messages ──
  const emptyMessages = {
    all: { icon: '🚀', title: 'No tasks yet!', sub: 'Add your first task above to get started.' },
    pending: { icon: '🎉', title: 'All caught up!', sub: 'No pending tasks — great work!' },
    done: { icon: '📋', title: 'Nothing completed yet.', sub: 'Finish a task and it will show here.' },
  };

  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="header">
        <div className="header-badge">
          <span className="dot" />
          Task Manager
        </div>
        <h1>TaskFlow</h1>
        <p>Stay organized. Ship faster. Feel great.</p>
      </header>

      {/* ── Stats Pills ── */}
      <div className="stats-bar" role="region" aria-label="Task statistics">
        <div className="stat-pill total">
          <span className="stat-icon">📋</span>
          <span className="stat-count">{tasks.length}</span> Total
        </div>
        <div className="stat-pill done">
          <span className="stat-icon">✅</span>
          <span className="stat-count">{doneCount}</span> Done
        </div>
        <div className="stat-pill pending">
          <span className="stat-icon">⏳</span>
          <span className="stat-count">{pendingCount}</span> Pending
        </div>
      </div>

      {/* ── Progress Ring ── */}
      {tasks.length > 0 && (
        <ProgressRing total={tasks.length} done={doneCount} />
      )}

      {/* ── Error Banner ── */}
      {error && (
        <div className="error-banner" role="alert">
          <span>⚠️</span>
          {error}
          <button className="error-dismiss" onClick={() => setError(null)} aria-label="Dismiss error">✕</button>
        </div>
      )}

      {/* ── Add Task Form ── */}
      <section className="add-task-section" aria-label="Add a new task">
        <form className="add-task-form" onSubmit={handleCreate}>
          <div className="task-input-wrapper">
            <span className="task-input-icon">✦</span>
            <input
              id="new-task-input"
              className="task-input"
              type="text"
              placeholder="Add a new task..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              disabled={submitting}
              aria-label="New task title"
              maxLength={200}
              autoComplete="off"
            />
          </div>
          <button
            id="add-task-btn"
            type="submit"
            className="btn-add"
            disabled={submitting || !newTitle.trim()}
            aria-label="Add task"
          >
            <span className="btn-icon">{submitting ? '⏳' : '+'}</span>
            {submitting ? 'Adding...' : 'Add Task'}
          </button>
        </form>
      </section>

      {/* ── Filters ── */}
      <div className="filter-section">
        <div className="filter-tabs" role="tablist" aria-label="Filter tasks">
          {['all', 'pending', 'done'].map(f => (
            <button
              key={f}
              id={`filter-${f}`}
              role="tab"
              aria-selected={filter === f}
              className={`filter-tab ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {' '}({f === 'all' ? tasks.length : f === 'done' ? doneCount : pendingCount})
            </button>
          ))}
        </div>
      </div>

      {/* ── Task List ── */}
      <main>
        {loading ? (
          <SkeletonList />
        ) : filteredTasks.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">{emptyMessages[filter].icon}</span>
            <h3>{emptyMessages[filter].title}</h3>
            <p>{emptyMessages[filter].sub}</p>
          </div>
        ) : (
          <div className="task-list" role="list" aria-label="Task list">
            {doneCount > 0 && filter === 'all' && pendingCount > 0 && (
              <>
                <div className="section-divider">Pending</div>
              </>
            )}
            {filteredTasks
              .filter(t => filter !== 'all' || !t.completed)
              .map((task, i) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                  onUpdate={handleUpdate}
                  style={{ animationDelay: `${i * 60}ms` }}
                />
              ))
            }
            {filter === 'all' && doneCount > 0 && pendingCount > 0 && (
              <div className="section-divider">Completed</div>
            )}
            {filteredTasks
              .filter(t => filter !== 'all' || t.completed)
              .map((task, i) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                  onUpdate={handleUpdate}
                  style={{ animationDelay: `${(pendingCount + i) * 60}ms` }}
                />
              ))
            }
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="footer">
        <p>Built with <span>♥</span> using React + Spring Boot</p>
      </footer>

      {/* ── Toast Container ── */}
      <div className="toast-container" aria-live="polite" aria-atomic="true">
        {toasts.map(t => (
          <Toast
            key={t.id}
            message={t.message}
            type={t.type}
            onExit={() => removeToast(t.id)}
          />
        ))}
      </div>
    </div>
  );
}