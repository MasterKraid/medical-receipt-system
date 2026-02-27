import React from 'react';

interface ChoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    message: string;
    onRevert: () => void;
    onDelete: () => void;
    revertLabel?: string;
    deleteLabel?: string;
}

const ChoiceModal: React.FC<ChoiceModalProps> = ({
    isOpen,
    onClose,
    title,
    message,
    onRevert,
    onDelete,
    revertLabel = "Revert (Full Undo)",
    deleteLabel = "Simple Delete (Entry Only)"
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop with Blur */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-md transition-opacity"
                onClick={onClose}
            ></div>

            {/* Modal Content */}
            <div className="relative bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 w-full max-w-md overflow-hidden transform transition-all animate-in fade-in zoom-in duration-200">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-600">
                            <i className="fa-solid fa-triangle-exclamation text-xl"></i>
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 tracking-tight">{title}</h3>
                    </div>

                    <p className="text-gray-600 text-sm leading-relaxed mb-8">
                        {message}
                    </p>

                    <div className="space-y-3">
                        <button
                            onClick={() => {
                                onRevert();
                                onClose();
                            }}
                            className="w-full flex items-center justify-between p-4 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all group relative overflow-hidden shadow-lg shadow-red-200 active:scale-[0.98]"
                        >
                            <div className="text-left">
                                <span className="block font-bold text-sm uppercase tracking-wider">{revertLabel}</span>
                                <span className="text-[10px] opacity-80">Full administrative undo of all related records</span>
                            </div>
                            <i className="fa-solid fa-rotate-left transition-transform group-hover:-rotate-45"></i>
                        </button>

                        <button
                            onClick={() => {
                                onDelete();
                                onClose();
                            }}
                            className="w-full flex items-center justify-between p-4 bg-slate-800 hover:bg-black text-white rounded-xl transition-all group relative overflow-hidden shadow-lg shadow-slate-200 active:scale-[0.98]"
                        >
                            <div className="text-left">
                                <span className="block font-bold text-sm uppercase tracking-wider">{deleteLabel}</span>
                                <span className="text-[10px] opacity-80">Remove entry record while preserving statistics</span>
                            </div>
                            <i className="fa-solid fa-trash-can transition-transform group-hover:scale-110"></i>
                        </button>
                    </div>

                    <div className="mt-6 flex justify-center">
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 text-xs font-bold uppercase tracking-widest transition-colors py-2 px-4"
                        >
                            Nevermind, Cancel
                        </button>
                    </div>
                </div>

                {/* Decorative Accent */}
                <div className="h-1.5 w-full bg-gradient-to-r from-red-500 via-slate-800 to-red-500"></div>
            </div>
        </div>
    );
};

export default ChoiceModal;
