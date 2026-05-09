import dynamic from 'next/dynamic'

const View = dynamic(() => import('../src/PcaView').then(m => m.PcaView), { ssr: false })

const Page = () => <View />

export default Page
