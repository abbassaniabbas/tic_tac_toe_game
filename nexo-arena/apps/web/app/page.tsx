import { Arena } from '@/components/arena';
import { WebAccountProvider } from '@/lib/online';
export default function Home() { return <WebAccountProvider><Arena/></WebAccountProvider>; }
