'use client';

import React, { useState, useEffect } from 'react';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp, where } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { Plus, Trash2, Tag, Loader2, Search, LayoutGrid, List as ListIcon, Heart, FolderOpen, X, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Campaign } from '@/types';

export default function CampaignManager() {
    const { userData } = useAuth();
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [searchQuery, setSearchQuery] = useState('');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');

    useEffect(() => {
        if (!userData?.churchId) return;

        const q = query(
            collection(db, 'campaigns'),
            orderBy('name', 'asc')
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const allData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Campaign[];

            // Match current church OR has no churchId (legacy - only for default church)
            const isLegacyVisible = userData.churchId === 'bethel-metro' || userData.role === 'super_admin';
            const filteredData = allData.filter(c =>
                c.churchId === userData.churchId || (!c.churchId && isLegacyVisible)
            );

            setCampaigns(filteredData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userData?.churchId, userData?.role]);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;

        setIsSubmitting(true);
        try {
            await addDoc(collection(db, 'campaigns'), {
                name: newName.trim(),
                description: newDesc.trim() || null,
                churchId: userData?.churchId || 'default_church',
                createdAt: serverTimestamp()
            });
            setNewName('');
            setNewDesc('');
            setIsModalOpen(false); // Close modal on success
            toast.success('Campaign created successfully');
        } catch (error) {
            console.error('Error adding campaign:', error);
            toast.error('Failed to create campaign');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete "${name}"? This cannot be undone.`)) return;
        try {
            await deleteDoc(doc(db, 'campaigns', id));
            toast.success('Campaign deleted');
        } catch (error) {
            console.error('Error deleting campaign:', error);
            toast.error('Failed to delete campaign');
        }
    };

    const filteredCampaigns = campaigns.filter(c =>
        (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.description || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) return (
        <div className="flex justify-center items-center h-64 bg-white rounded-xl border border-gray-100 shadow-sm">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Professional Header Area */}
            <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-sm border border-gray-200 p-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-bold tracking-wide uppercase">Giving Funds</span>
                        </div>
                        <h3 className="text-3xl font-extrabold text-gray-900 tracking-tight">Campaigns</h3>
                        <p className="text-gray-500 max-w-lg text-lg">
                            Manage the designation options available for your donors.
                        </p>
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="group flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-semibold shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5"
                    >
                        <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                        <span>New Campaign</span>
                    </button>
                </div>

                {/* Filters Bar */}
                <div className="mt-8 flex flex-col md:flex-row gap-4 items-center justify-between border-t border-gray-200 pt-6">
                    <div className="relative w-full md:w-96 group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                        </div>
                        <input
                            type="text"
                            className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all shadow-sm"
                            placeholder="Search campaigns..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center space-x-2 bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-gray-100 text-blue-600 shadow-inner' : 'text-gray-400 hover:text-gray-600'}`}
                            title="Grid View"
                        >
                            <LayoutGrid className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-gray-100 text-blue-600 shadow-inner' : 'text-gray-400 hover:text-gray-600'}`}
                            title="List View"
                        >
                            <ListIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Campaign Grid/List */}
            <div>
                {filteredCampaigns.length === 0 ? (
                    <div className="flex flex-col items-center justify-center bg-white rounded-2xl border-2 border-dashed border-gray-200 p-16 text-center group hover:border-blue-200 transition-colors">
                        <div className="bg-blue-50 p-4 rounded-full mb-4 group-hover:scale-110 transition-transform">
                            <Tag className="w-8 h-8 text-blue-500" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">No campaigns found</h3>
                        <p className="text-gray-500 max-w-sm mx-auto mb-6">
                            {searchQuery ? "Try adjusting your search terms." : "Get started by creating your first campaign fund."}
                        </p>
                        {!searchQuery && (
                            <button
                                onClick={() => setIsModalOpen(true)}
                                className="text-blue-600 font-semibold hover:text-blue-800 hover:underline"
                            >
                                Create one now &rarr;
                            </button>
                        )}
                    </div>
                ) : (
                    <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "flex flex-col space-y-3"}>
                        {filteredCampaigns.map((campaign) => (
                            <div
                                key={campaign.id}
                                className={`
                                    bg-white border text-left rounded-2xl transition-all duration-200
                                    ${viewMode === 'grid'
                                        ? 'border-gray-200 p-6 shadow-sm hover:shadow-md hover:border-blue-200 flex flex-col h-full hover:-translate-y-1'
                                        : 'border-gray-100 p-4 shadow-sm hover:border-blue-200 flex items-center justify-between'
                                    }
                                `}
                            >
                                <div className={`flex items-start gap-4 ${viewMode === 'grid' ? '' : 'flex-1'}`}>
                                    <div className={`
                                        rounded-xl flex items-center justify-center flex-shrink-0 transition-colors
                                        ${viewMode === 'grid' ? 'w-12 h-12 bg-blue-50 text-blue-600 mb-4' : 'w-10 h-10 bg-gray-50 text-gray-400'}
                                    `}>
                                        <Heart className={`${viewMode === 'grid' ? 'w-6 h-6' : 'w-5 h-5'}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-gray-900 text-lg line-clamp-1">{campaign.name}</h4>
                                        {campaign.description ? (
                                            <p className="text-sm text-gray-500 mt-1 line-clamp-2 leading-relaxed">{campaign.description}</p>
                                        ) : (
                                            <p className="text-sm text-gray-300 mt-1 italic">No description provided</p>
                                        )}
                                    </div>
                                </div>

                                <div className={`${viewMode === 'grid' ? 'mt-6 pt-4 border-t border-gray-50 flex justify-end' : 'ml-4'}`}>
                                    <button
                                        onClick={() => handleDelete(campaign.id, campaign.name)}
                                        className="text-gray-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors"
                                        title="Delete Campaign"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Create Campaign Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Create New Campaign</h3>
                                <p className="text-xs text-gray-500 mt-0.5">Add a new fund for donors to select.</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleAdd} className="p-6 space-y-5">
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">Campaign Name <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="e.g. Building Fund"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-transparent outline-none transition-all placeholder:text-gray-400"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">Description <span className="text-gray-400 font-normal text-xs ml-1">(Optional)</span></label>
                                <textarea
                                    placeholder="Brief details about what this fund supports..."
                                    value={newDesc}
                                    onChange={(e) => setNewDesc(e.target.value)}
                                    rows={4}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-transparent outline-none transition-all resize-none placeholder:text-gray-400"
                                />
                            </div>

                            <div className="pt-2 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !newName.trim()}
                                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium shadow-md hover:shadow-lg transition-all flex items-center justify-center disabled:opacity-50 disabled:shadow-none"
                                >
                                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Campaign'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
