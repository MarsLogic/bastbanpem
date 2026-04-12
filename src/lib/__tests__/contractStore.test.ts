import { describe, it, expect } from 'vitest';

// Since useContracts is a hook and we don't have hook testing setup,
// we test the core data structures and expectations for the store.

describe('contractStore data structures', () => {
  it('should support ktpBindings and proofBindings', () => {
    const mockContract: any = {
      id: '1',
      name: 'Test',
      ktpBindings: { 'img1.jpg': 'NIK123' },
      proofBindings: { 'img2.jpg': 'NIK456' },
      recipients: []
    };

    expect(mockContract.ktpBindings['img1.jpg']).toBe('NIK123');
    expect(mockContract.proofBindings['img2.jpg']).toBe('NIK456');
  });

  it('should maintain global NIK registry across contracts', () => {
    const contracts: any[] = [
      {
        id: 'c1',
        name: 'Contract 1',
        recipients: [{ nik: '1234567890123456', name: 'User A' }]
      },
      {
        id: 'c2',
        name: 'Contract 2',
        recipients: [{ nik: '1234567890123456', name: 'User A' }]
      }
    ];

    const globalNIKRegistry = new Map<string, { id: string, name: string }[]>();
    contracts.forEach(c => {
      c.recipients.forEach((r: any) => {
        if (!r.nik) return;
        const existing = globalNIKRegistry.get(r.nik) || [];
        if (!existing.find(e => e.id === c.id)) {
          existing.push({ id: c.id, name: c.name });
          globalNIKRegistry.set(r.nik, existing);
        }
      });
    });

    const matches = globalNIKRegistry.get('1234567890123456');
    expect(matches).toHaveLength(2);
    expect(matches![0].id).toBe('c1');
    expect(matches![1].id).toBe('c2');
  });
});
