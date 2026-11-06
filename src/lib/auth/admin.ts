import 'server-only';
import { auth } from './server';
// @neon/auth 0.8.2 exposes the managed admin endpoint tree at runtime, but its
// exported Next server type infers it as unknown. Narrow only the documented
// operations used here; all calls still use the SDK's authenticated proxy.
type Identity = {id: string; email: string; name?: string};
type Result<T> = Promise<{data: T | null; error: {code?: string; message?: string; status?: number} | null}>;
interface ManagedAdmin {
 listUsers(input: {query: {searchValue: string; searchField: 'email'; searchOperator: 'contains'; limit: number}}): Result<{users: Identity[]}>;
 createUser(input: {email: string; password: string; name: string; role: 'user'}): Result<{user: Identity}>;
 updateUser(input: {userId: string; data: {name: string}}): Result<{user: Identity}>;
 setUserPassword(input: {userId: string; newPassword: string}): Result<{status: boolean}>;
 revokeUserSessions(input: {userId: string}): Result<{status: boolean}>;
}
export const managedAdmin = auth.admin as ManagedAdmin;
