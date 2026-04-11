import React, { useState } from 'react';
import { Toaster } from "@/components/ui/sonner";
import { useContracts } from './lib/contractStore';
import { ContractListView } from './components/ContractListView';
import { ContractDetailView } from './components/ContractDetailView';

const App: React.FC = () => {
  const { contracts, globalNIKRegistry, createContract, updateContract, deleteContract } = useContracts();
  const [activeContractId, setActiveContractId] = useState<string | null>(null);

  // Derive the active contract object
  const activeContract = activeContractId 
    ? contracts.find(c => c.id === activeContractId) || null
    : null;

  return (
    <div className="h-screen w-full bg-background text-foreground overflow-hidden font-sans">
      <Toaster position="bottom-right" closeButton duration={2500} expand={false} richColors />
      
      {activeContract ? (
        <ContractDetailView 
          contract={activeContract}
          globalNIKRegistry={globalNIKRegistry}
          onBack={() => setActiveContractId(null)}
          onUpdate={updateContract}
        />
      ) : (
        <ContractListView 
          contracts={contracts}
          onCreateContract={(name) => {
            const id = createContract(name);
            setActiveContractId(id);
          }}
          onSelectContract={setActiveContractId}
          onDeleteContract={deleteContract}
        />
      )}
      
    </div>
  );
};

export default App;
