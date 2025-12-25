import React, { useMemo } from 'react';
import { Lab, PackageList } from '../types';

interface RateListAccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    labs: Lab[];
    packageLists: PackageList[];
    selectedListIds: Set<number>;
    onToggle: (listId: number) => void;
}

const RateListAccessModal: React.FC<RateListAccessModalProps> = ({ isOpen, onClose, labs, packageLists, selectedListIds, onToggle }) => {
    const columns = useMemo(() => {
        const assignedToListIds = new Set<number>();
        const labGroups: { labName: string; lists: PackageList[] }[] = [];

        // Group by labs
        labs.forEach(lab => {
            const lists = packageLists.filter(pl => lab.assigned_list_ids?.includes(pl.id));
            lists.forEach(l => assignedToListIds.add(l.id));
            if (lists.length > 0) {
                labGroups.push({ labName: lab.name, lists });
            }
        });

        // Orphans (Unassigned)
        const orphans = packageLists.filter(pl => !assignedToListIds.has(pl.id));
        if (orphans.length > 0) {
            labGroups.push({ labName: 'Unassigned Lists', lists: orphans });
        }

        return labGroups;
    }, [labs, packageLists]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden border border-gray-200">
                {/* Header */}
                <div className="p-4 border-b border-gray-300 flex justify-between items-center bg-gray-50/50">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">Rate Database Access</h2>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mt-0.5">Configure Rate list visibility per account</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600">
                        <i className="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                {/* Content - Horizontal Scrollable Columns */}
                <div className="flex-1 overflow-x-auto overflow-y-hidden p-4 bg-white">
                    <div className="flex gap-4 h-full min-w-max">
                        {columns.map((col, idx) => (
                            <div key={idx} className="w-64 flex flex-col border border-gray-200 rounded-lg bg-gray-50 shadow-sm overflow-hidden">
                                <div className="p-2 border-b border-gray-200 bg-white sticky top-0 z-10 flex justify-between items-center">
                                    <h3 className="font-bold text-gray-700 text-xs truncate flex items-center gap-1.5">
                                        <i className={`fa-solid ${col.labName === 'Unassigned Lists' ? 'fa-folder-open text-orange-400' : 'fa-flask-vial text-blue-500'} text-[10px]`}></i>
                                        {col.labName}
                                    </h3>
                                    <span className="text-[9px] font-black text-gray-300 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                                        {col.lists.length}
                                    </span>
                                </div>
                                <div className="flex-1 overflow-y-auto p-1.5 space-y-1 custom-scrollbar-minimal">
                                    {col.lists.map(list => {
                                        const isSelected = selectedListIds.has(list.id);
                                        return (
                                            <div
                                                key={list.id}
                                                onClick={() => onToggle(list.id)}
                                                className={`group flex items-center justify-between px-2.5 py-1.5 rounded cursor-pointer transition-all border text-xs ${isSelected
                                                    ? 'bg-blue-600 border-blue-700 text-white shadow-sm'
                                                    : 'bg-white border-gray-100 hover:border-gray-300 text-gray-600'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-2 truncate">
                                                    <div className={`w-4 h-4 rounded-sm border flex items-center justify-center transition-all ${isSelected ? 'bg-white border-white text-blue-600' : 'bg-white border-gray-300'
                                                        }`}>
                                                        {isSelected && <i className="fa-solid fa-check text-[8px]"></i>}
                                                    </div>
                                                    <span className="font-semibold truncate">{list.name}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-3 border-t border-gray-300 bg-gray-50 flex justify-between items-center">
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-wider px-2">
                        <i className="fa-solid fa-circle-info text-blue-400"></i>
                        {selectedListIds.size} Lists Assigned
                    </div>
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm transition-all text-xs"
                    >
                        Apply Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RateListAccessModal;
