"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    transferSpaceOwnership,
    searchUsers,
} from "../lib/control-plane";
import { useToast } from "./toast-provider";

interface SpaceOwnershipTransferProps {
    serverId: string;
}

export function SpaceOwnershipTransfer({ serverId }: SpaceOwnershipTransferProps) {
    const { showToast } = useToast();
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [transferring, setTransferring] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    useEffect(() => {
        const debounce = setTimeout(async () => {
            if (searchQuery.length >= 3) {
                try {
                    const results = await searchUsers(searchQuery);
                    setSearchResults(results);
                } catch (err) {
                    console.error("Failed to search users", err);
                }
            } else {
                setSearchResults([]);
            }
        }, 300);
        return () => clearTimeout(debounce);
    }, [searchQuery]);

    const handleTransfer = async () => {
        if (!selectedUser) return;
        setTransferring(true);
        try {
            await transferSpaceOwnership({
                serverId,
                newOwnerUserId: selectedUser.productUserId,
            });
            showToast("Space ownership transferred successfully", "success");
            setShowConfirm(false);
            setSearchQuery("");
            setSelectedUser(null);
            setSearchResults([]);
            // Reload the page or redirect, as they might have lost access
            router.refresh();
        } catch (err: any) {
            showToast(err.message || "Failed to transfer ownership", "error");
            setShowConfirm(false);
        } finally {
            setTransferring(false);
        }
    };

    return (
        <section className="settings-section danger-zone" style={{ marginTop: '3rem', padding: '1.5rem', border: '1px solid var(--danger, #ff4d4f)', borderRadius: '8px', background: 'rgba(255, 77, 79, 0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ color: 'var(--danger, #ff4d4f)', margin: 0 }}>Transfer Ownership</h3>
            </div>
            <p className="settings-description" style={{ marginTop: '0.5rem', marginBottom: '1.5rem', color: 'var(--text-main)' }}>
                Transferring ownership gives full control of this space to another user. You will lose permanent ownership rights, but the new owner may choose to keep you as a delegated admin.
            </p>

            <div className="transfer-form">
                <div style={{ position: 'relative' }}>
                    <input
                        type="text"
                        placeholder="Search users to transfer ownership to..."
                        value={selectedUser ? selectedUser.displayName || selectedUser.username : searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setSelectedUser(null);
                            setShowConfirm(false);
                        }}
                        style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--danger, #ff4d4f)', background: 'var(--bg-input)', color: 'var(--text-main)', marginBottom: '1rem' }}
                    />

                    {!selectedUser && searchResults.length > 0 && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '6px', zIndex: 10, maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                            {searchResults.map(user => (
                                <div
                                    key={user.productUserId}
                                    onClick={() => {
                                        setSelectedUser(user);
                                        setSearchQuery("");
                                        setSearchResults([]);
                                    }}
                                    style={{ padding: '0.75rem', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
                                    className="search-result-item"
                                >
                                    {user.avatarUrl ? (
                                        <img src={user.avatarUrl} alt="" style={{ width: '24px', height: '24px', borderRadius: '50%' }} />
                                    ) : (
                                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: 'white' }}>
                                            {(user.displayName || user.username || "?")[0].toUpperCase()}
                                        </div>
                                    )}
                                    <div>
                                        <div style={{ fontWeight: 600 }}>{user.displayName || user.username}</div>
                                        {user.displayName && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>@{user.username}</div>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {!showConfirm ? (
                    <button
                        className="danger-button"
                        onClick={() => setShowConfirm(true)}
                        disabled={!selectedUser}
                        style={{ justifySelf: 'start', padding: '0.6rem 1.2rem' }}
                    >
                        Transfer Ownership
                    </button>
                ) : (
                    <div className="confirm-box" style={{ padding: '1rem', background: 'var(--bg-surface)', border: '1px solid var(--danger, #ff4d4f)', borderRadius: '6px', marginTop: '1rem' }}>
                        <p style={{ margin: '0 0 1rem 0', fontWeight: 'bold', color: 'var(--danger, #ff4d4f)' }}>Are you absolutely sure?</p>
                        <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem' }}>This action cannot be undone. You are transferring full ownership to <strong>{selectedUser.displayName || selectedUser.username}</strong>.</p>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button
                                className="danger-button"
                                onClick={handleTransfer}
                                disabled={transferring}
                                style={{ padding: '0.6rem 1.2rem' }}
                            >
                                {transferring ? "Transferring..." : "Yes, Transfer Ownership"}
                            </button>
                            <button
                                onClick={() => setShowConfirm(false)}
                                disabled={transferring}
                                style={{ padding: '0.6rem 1.2rem', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-main)' }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>
            <style jsx>{`
                .search-result-item:hover {
                    background: var(--bg-surface-hover);
                }
                button.danger-button {
                    background: var(--danger, #ff4d4f);
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 600;
                }
                button.danger-button:hover:not(:disabled) {
                    background: #ff7875;
                }
                button.danger-button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
            `}</style>
        </section>
    );
}
