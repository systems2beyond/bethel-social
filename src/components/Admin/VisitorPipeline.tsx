'use client';

import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Visitor } from '@/types';
import { Loader2, UserPlus, CheckCircle, Clock, Archive, Trash2, Mail, Phone, MessageSquare } from 'lucide-react';

export default function VisitorPipeline() {
    const [visitors, setVisitors] = useState<Visitor[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, 'visitors'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Visitor[];
            setVisitors(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleStatusChange = async (id: string, newStatus: Visitor['status']) => {
        try {
            await updateDoc(doc(db, 'visitors', id), {
                status: newStatus
            });
        } catch (error) {
            console.error("Error updating status:", error);
            alert("Failed to update status");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this visitor record?")) return;
        try {
            await deleteDoc(doc(db, 'visitors', id));
        } catch (error) {
            console.error("Error deleting visitor:", error);
            alert("Failed to delete visitor");
        }
    };

    if (loading) {
        return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
    }

    // Group visitors by status
    const newVisitors = visitors.filter(v => v.status === 'new');
    const contactedVisitors = visitors.filter(v => v.status === 'contacted');

    return (
        <div className="space-y-8">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-center justify-between">
                    <div>
                        <p className="text-blue-600 text-sm font-medium">New Visitors</p>
                        <h3 className="text-2xl font-bold text-blue-900">{newVisitors.length}</h3>
                    </div>
                    <UserPlus className="w-8 h-8 text-blue-300" />
                </div>
                <div className="bg-green-50 p-4 rounded-xl border border-green-100 flex items-center justify-between">
                    <div>
                        <p className="text-green-600 text-sm font-medium">Contacted</p>
                        <h3 className="text-2xl font-bold text-green-900">{contactedVisitors.length}</h3>
                    </div>
                    <MessageSquare className="w-8 h-8 text-green-300" />
                </div>
                {/* Placeholder for Conversion Rate or other stat */}
            </div>

            {/* Pipeline List - Focusing on New First */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="font-bold text-gray-900 flex items-center">
                        <Clock className="w-4 h-4 mr-2 text-blue-500" />
                        Recent Visitors
                    </h3>
                </div>

                {visitors.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        <p>No visitors yet. Check the Connect page!</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {visitors.map((visitor) => (
                            <div key={visitor.id} className="p-6 hover:bg-gray-50 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center space-x-3 mb-1">
                                        <h4 className="font-bold text-gray-900 text-lg">
                                            {visitor.firstName} {visitor.lastName}
                                        </h4>
                                        {visitor.isFirstTime && (
                                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                                                1st Time
                                            </span>
                                        )}
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium uppercase ${visitor.status === 'new' ? 'bg-yellow-100 text-yellow-800' :
                                            visitor.status === 'contacted' ? 'bg-green-100 text-green-800' :
                                                'bg-gray-100 text-gray-600'
                                            }`}>
                                            {visitor.status}
                                        </span>
                                    </div>

                                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                                        {visitor.email && (
                                            <div className="flex items-center">
                                                <Mail className="w-3 h-3 mr-1.5 text-gray-400" />
                                                {visitor.email}
                                            </div>
                                        )}
                                        {visitor.phone && (
                                            <div className="flex items-center">
                                                <Phone className="w-3 h-3 mr-1.5 text-gray-400" />
                                                {visitor.phone}
                                            </div>
                                        )}
                                        <div className="flex items-center text-gray-400">
                                            <Clock className="w-3 h-3 mr-1.5" />
                                            {visitor.createdAt?.toDate ? visitor.createdAt.toDate().toLocaleDateString() : 'Just now'}
                                        </div>
                                    </div>

                                    {visitor.prayerRequests && (
                                        <div className="mt-3 bg-gray-50 p-3 rounded-lg text-sm text-gray-700 italic border border-gray-100">
                                            "{visitor.prayerRequests}"
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex items-center space-x-2">
                                    {visitor.status === 'new' && (
                                        <button
                                            onClick={() => handleStatusChange(visitor.id, 'contacted')}
                                            className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 shadow-sm flex items-center"
                                        >
                                            <CheckCircle className="w-4 h-4 mr-1.5" />
                                            Mark Contacted
                                        </button>
                                    )}
                                    {visitor.status !== 'archived' && (
                                        <button
                                            onClick={() => handleStatusChange(visitor.id, 'archived')}
                                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                                            title="Archive"
                                        >
                                            <Archive className="w-4 h-4" />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleDelete(visitor.id)}
                                        className="p-2 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                        title="Delete"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
