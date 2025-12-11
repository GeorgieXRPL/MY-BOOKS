import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { useAuthStore } from "../store/auth";

interface TeamMember {
  id: string;
  email: string;
  name?: string;
  roles: string[];
  isActive: boolean;
  lastLoginAt?: string;
}

interface Invitation {
  id: string;
  email: string;
  roles: string[];
  expiresAt: string;
}

const AVAILABLE_ROLES = ["admin", "poster", "approver", "viewer", "auditor"];

const TeamPage = () => {
  const { user } = useAuthStore();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoles, setInviteRoles] = useState<string[]>(["viewer"]);
  const [inviting, setInviting] = useState(false);

  // Edit modal
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [editRoles, setEditRoles] = useState<string[]>([]);

  const fetchTeam = async () => {
    try {
      const res = await api.get("/security/team");
      setMembers(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load team");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    setError("");
    setSuccess("");

    try {
      await api.post("/security/team/invite", {
        email: inviteEmail,
        roles: inviteRoles
      });
      setSuccess(`Invitation sent to ${inviteEmail}`);
      setInviteEmail("");
      setInviteRoles(["viewer"]);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to send invitation");
    } finally {
      setInviting(false);
    }
  };

  const handleUpdateRoles = async () => {
    if (!editingMember) return;
    setError("");
    setSuccess("");

    try {
      await api.patch(`/security/team/${editingMember.id}/roles`, {
        roles: editRoles
      });
      setSuccess(`Updated roles for ${editingMember.email}`);
      setEditingMember(null);
      fetchTeam();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to update roles");
    }
  };

  const handleDisable = async (member: TeamMember) => {
    if (!confirm(`Disable ${member.email}? They will lose access immediately.`)) return;
    setError("");
    setSuccess("");

    try {
      await api.post(`/security/team/${member.id}/disable`);
      setSuccess(`Disabled ${member.email}`);
      fetchTeam();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to disable user");
    }
  };

  const toggleInviteRole = (role: string) => {
    setInviteRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const toggleEditRole = (role: string) => {
    setEditRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  if (loading) {
    return <div className="card">Loading team...</div>;
  }

  return (
    <div className="team-page">
      <div className="page-header">
        <h1>Team Management</h1>
        <p>Invite team members and manage their access</p>
      </div>

      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      {/* Invite Form */}
      <div className="card invite-card">
        <h2>Invite New Member</h2>
        <form onSubmit={handleInvite} className="invite-form">
          <div className="form-row">
            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                className="input"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Roles</label>
            <div className="roles-grid">
              {AVAILABLE_ROLES.map((role) => (
                <label key={role} className="role-checkbox">
                  <input
                    type="checkbox"
                    checked={inviteRoles.includes(role)}
                    onChange={() => toggleInviteRole(role)}
                  />
                  <span className="role-name">{role}</span>
                  <span className="role-desc">{getRoleDescription(role)}</span>
                </label>
              ))}
            </div>
          </div>

          <button type="submit" className="btn primary" disabled={inviting || !inviteEmail}>
            {inviting ? "Sending..." : "Send Invitation"}
          </button>
        </form>
      </div>

      {/* Team Members */}
      <div className="card">
        <h2>Team Members ({members.length})</h2>
        <div className="team-table">
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Roles</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className={!member.isActive ? "disabled" : ""}>
                  <td>
                    <div className="member-info">
                      <div className="member-avatar">
                        {(member.name || member.email)[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="member-name">{member.name || "—"}</div>
                        <div className="member-email">{member.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="role-tags">
                      {member.roles.map((role) => (
                        <span key={role} className={`role-tag ${role}`}>
                          {role}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <span className={`status-badge ${member.isActive ? "active" : "inactive"}`}>
                      {member.isActive ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td>
                    {member.lastLoginAt
                      ? new Date(member.lastLoginAt).toLocaleDateString()
                      : "Never"}
                  </td>
                  <td>
                    {member.id !== user?.id && member.isActive && (
                      <div className="action-buttons">
                        <button
                          className="btn small"
                          onClick={() => {
                            setEditingMember(member);
                            setEditRoles([...member.roles]);
                          }}
                        >
                          Edit Roles
                        </button>
                        <button
                          className="btn small danger"
                          onClick={() => handleDisable(member)}
                        >
                          Disable
                        </button>
                      </div>
                    )}
                    {member.id === user?.id && (
                      <span className="you-badge">You</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editingMember && (
        <div className="modal-overlay" onClick={() => setEditingMember(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Roles for {editingMember.email}</h3>
            <div className="roles-grid">
              {AVAILABLE_ROLES.map((role) => (
                <label key={role} className="role-checkbox">
                  <input
                    type="checkbox"
                    checked={editRoles.includes(role)}
                    onChange={() => toggleEditRole(role)}
                  />
                  <span className="role-name">{role}</span>
                </label>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setEditingMember(null)}>
                Cancel
              </button>
              <button className="btn primary" onClick={handleUpdateRoles}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .team-page {
          max-width: 1000px;
        }

        .page-header {
          margin-bottom: 1.5rem;
        }

        .page-header h1 {
          margin: 0 0 0.25rem;
          color: #f1f5f9;
        }

        .page-header p {
          margin: 0;
          color: #64748b;
        }

        .alert {
          padding: 0.75rem 1rem;
          border-radius: 8px;
          margin-bottom: 1rem;
        }

        .alert.error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #fca5a5;
        }

        .alert.success {
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.3);
          color: #86efac;
        }

        .invite-card {
          margin-bottom: 1.5rem;
        }

        .invite-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .form-row {
          display: flex;
          gap: 1rem;
        }

        .form-row .form-group {
          flex: 1;
        }

        .roles-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 0.5rem;
        }

        .role-checkbox {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          padding: 0.75rem;
          background: rgba(30, 41, 59, 0.5);
          border-radius: 8px;
          cursor: pointer;
        }

        .role-checkbox:hover {
          background: rgba(30, 41, 59, 0.8);
        }

        .role-checkbox input {
          margin-top: 2px;
        }

        .role-name {
          font-weight: 500;
          color: #e2e8f0;
          text-transform: capitalize;
        }

        .role-desc {
          display: block;
          font-size: 0.75rem;
          color: #64748b;
        }

        .team-table {
          overflow-x: auto;
        }

        .team-table table {
          width: 100%;
          border-collapse: collapse;
        }

        .team-table th,
        .team-table td {
          padding: 0.75rem;
          text-align: left;
          border-bottom: 1px solid rgba(148, 163, 184, 0.1);
        }

        .team-table th {
          color: #94a3b8;
          font-weight: 500;
          font-size: 0.875rem;
        }

        .team-table tr.disabled {
          opacity: 0.5;
        }

        .member-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .member-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 600;
        }

        .member-name {
          color: #f1f5f9;
          font-weight: 500;
        }

        .member-email {
          color: #64748b;
          font-size: 0.875rem;
        }

        .role-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.25rem;
        }

        .role-tag {
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 500;
          text-transform: capitalize;
        }

        .role-tag.admin { background: rgba(239, 68, 68, 0.2); color: #fca5a5; }
        .role-tag.poster { background: rgba(59, 130, 246, 0.2); color: #93c5fd; }
        .role-tag.approver { background: rgba(34, 197, 94, 0.2); color: #86efac; }
        .role-tag.viewer { background: rgba(148, 163, 184, 0.2); color: #cbd5e1; }
        .role-tag.auditor { background: rgba(168, 85, 247, 0.2); color: #d8b4fe; }

        .status-badge {
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 500;
        }

        .status-badge.active {
          background: rgba(34, 197, 94, 0.2);
          color: #86efac;
        }

        .status-badge.inactive {
          background: rgba(239, 68, 68, 0.2);
          color: #fca5a5;
        }

        .action-buttons {
          display: flex;
          gap: 0.5rem;
        }

        .btn.small {
          padding: 0.375rem 0.75rem;
          font-size: 0.75rem;
        }

        .btn.danger {
          background: rgba(239, 68, 68, 0.2);
          color: #fca5a5;
        }

        .btn.danger:hover {
          background: rgba(239, 68, 68, 0.3);
        }

        .you-badge {
          padding: 0.25rem 0.5rem;
          background: rgba(99, 102, 241, 0.2);
          color: #a5b4fc;
          border-radius: 4px;
          font-size: 0.75rem;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal {
          background: #1e293b;
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 12px;
          padding: 1.5rem;
          width: 90%;
          max-width: 500px;
        }

        .modal h3 {
          margin: 0 0 1rem;
          color: #f1f5f9;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.5rem;
          margin-top: 1.5rem;
        }
      `}</style>
    </div>
  );
};

function getRoleDescription(role: string): string {
  switch (role) {
    case "admin": return "Full access, manage team";
    case "poster": return "Create & edit entries";
    case "approver": return "Review & approve";
    case "viewer": return "Read-only access";
    case "auditor": return "View audit logs";
    default: return "";
  }
}

export default TeamPage;



