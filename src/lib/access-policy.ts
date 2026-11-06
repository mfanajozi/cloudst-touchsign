export type WorkspaceRole = 'ADMIN' | 'UPLOADER' | 'SIGNER';
export function canUpload(role: WorkspaceRole) { return role === 'ADMIN' || role === 'UPLOADER'; }
export function canManageDocument(user: {id: string; role: WorkspaceRole}, document: {uploader_id: string}) {
 return user.role === 'ADMIN' || (user.role === 'UPLOADER' && document.uploader_id === user.id);
}
export function canReadDocument(user: {id: string; authId: string; role: WorkspaceRole}, document: {uploader_id: string}, assignedAuthIds: string[]) {
 return user.role === 'ADMIN' || document.uploader_id === user.id || assignedAuthIds.includes(user.authId);
}
export function canManageUser(actor: {id: string; role: WorkspaceRole}, target: {id: string; role: WorkspaceRole}) {
 return actor.role === 'ADMIN' && actor.id !== target.id && target.role !== 'ADMIN';
}
