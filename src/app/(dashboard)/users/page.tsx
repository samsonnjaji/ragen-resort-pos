import { UsersClient } from "@/components/users/users-client";
import { getUsers } from "@/lib/actions/admin";

export default async function UsersPage() {
  try {
    const users = await getUsers();
    return <UsersClient users={users} />;
  } catch (error) {
    console.error("[UsersPage]", error);
    return <UsersClient users={[]} loadError="Unable to load users. Check your connection and refresh." />;
  }
}
