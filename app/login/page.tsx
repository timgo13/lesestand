import { LoginForm } from "@/components/LoginForm";
import { safeNextPath } from "@/lib/paths";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  return (
    <main>
      <LoginForm nextPath={safeNextPath(params.next)} />
    </main>
  );
}
