import dynamic from 'next/dynamic'

const View = dynamic(() => import('../src/TestView').then(m => m.TestView), { ssr: false })

const Page = () => <View />

export default Page
