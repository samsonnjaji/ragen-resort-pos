import { UsersClient } from "@/components/users/users-client";
import { getUsers } from "@/lib/actions/admin";

export default async function UsersPage() {
  const users = await getUsers();
  return <UsersClient users={users} />;
}
