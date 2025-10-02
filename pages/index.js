import Head from 'next/head';
import dynamic from 'next/dynamic';

// Cargamos tu UI original como componente para mantener este archivo liviano.
const AppUI = dynamic(() => import('../components/AppUI'), { ssr: false });

export default function IndexPage() {
    return (
        <>
            <Head>
                <title>Inglés - Tarjetas</title>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
            </Head>
            <AppUI />
        </>
    );
}