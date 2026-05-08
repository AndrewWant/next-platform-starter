import LoginForm from './login-form';

export const metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }) {
  const { next = '/' } = await searchParams;
  return <LoginForm next={next} />;
}
