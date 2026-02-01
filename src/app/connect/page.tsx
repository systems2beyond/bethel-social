'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { VisitorsService } from '@/lib/visitors';

export default function ConnectPage() {
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        phone: '',
        email: '',
        isFirstTime: false,
        prayerRequests: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await VisitorsService.createVisitor(formData);
            setSuccess(true);
        } catch (error) {
            console.error('Error submitting form:', error);
            alert('Something went wrong. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6 text-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-md w-full bg-zinc-900 border border-zinc-800 p-8 rounded-3xl"
                >
                    <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Welcome Home!</h1>
                    <p className="text-zinc-400">Thanks for connecting with us. Access your "Digital Connection Card" anytime.</p>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 sm:p-6">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-lg"
            >
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-block px-4 py-1.5 rounded-full bg-blue-500/10 text-blue-400 text-sm font-medium mb-4 border border-blue-500/20">
                        Digital Connection Card
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">Bethel Metropolitan</h1>
                    <p className="text-zinc-400">We're so glad you're here today.</p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="bg-zinc-900/50 backdrop-blur-md border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-400">First Name</label>
                            <input
                                required
                                value={formData.firstName}
                                onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                                className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-zinc-600"
                                placeholder="John"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-400">Last Name</label>
                            <input
                                required
                                value={formData.lastName}
                                onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                                className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-zinc-600"
                                placeholder="Doe"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-400">Mobile Phone</label>
                        <input
                            type="tel"
                            value={formData.phone}
                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-zinc-600"
                            placeholder="(555) 123-4567"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-400">Email Address (Optional)</label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                            className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-zinc-600"
                            placeholder="john@example.com"
                        />
                    </div>

                    <div className="pt-2">
                        <label className="flex items-center gap-3 p-4 rounded-xl bg-zinc-800/30 border border-zinc-700/30 cursor-pointer hover:bg-zinc-800/50 transition-colors">
                            <input
                                type="checkbox"
                                checked={formData.isFirstTime}
                                onChange={e => setFormData({ ...formData, isFirstTime: e.target.checked })}
                                className="w-5 h-5 rounded border-zinc-600 bg-zinc-700 text-blue-500 focus:ring-blue-500/50"
                            />
                            <span className="text-zinc-300 font-medium">This is my first time visiting</span>
                        </label>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-400">How can we pray for you?</label>
                        <textarea
                            value={formData.prayerRequests}
                            onChange={e => setFormData({ ...formData, prayerRequests: e.target.value })}
                            className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-zinc-600 min-h-[100px] resize-none"
                            placeholder="Share a prayer request or just say hello..."
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                    >
                        {submitting ? 'Connecting...' : 'Connect With Us'}
                    </button>

                </form>

                <div className="text-center mt-8 text-zinc-600 text-sm">
                    Protected by Bethel Secure &bull; Privacy Policy
                </div>
            </motion.div>
        </div>
    );
}
