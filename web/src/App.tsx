import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AdminRoute } from './components/AdminRoute'
import { Layout } from './components/Layout'
import { TrackerRemoteSync } from './components/TrackerRemoteSync'
import { RequireAuth } from './components/RequireAuth'
import { ChangePassword } from './pages/ChangePassword'
import { Chat } from './pages/Chat'
import { Dashboard } from './pages/Dashboard'
import { ItemDetail } from './pages/ItemDetail'
import { Items } from './pages/Items'
import { KnowledgeBase } from './pages/KnowledgeBase'
import { Login } from './pages/Login'
import { Matrix } from './pages/Matrix'
import { Me } from './pages/Me'
import { People } from './pages/People'
import { PersonDetail } from './pages/PersonDetail'
import { RegisterTeam } from './pages/RegisterTeam'
import { Settings } from './pages/Settings'

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <TrackerRemoteSync />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<RegisterTeam />} />
        <Route element={<RequireAuth />}>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="change-password" element={<ChangePassword />} />
            <Route path="me" element={<Me />} />
            <Route path="chat/:peerName" element={<Chat />} />
            <Route path="chat" element={<Chat />} />
            <Route path="items/:itemId" element={<ItemDetail />} />
            <Route path="items" element={<Items />} />
            <Route path="kb/:pageId" element={<KnowledgeBase />} />
            <Route path="kb" element={<KnowledgeBase />} />
            <Route path="people/:personName" element={<PersonDetail />} />
            <Route element={<AdminRoute />}>
              <Route path="people" element={<People />} />
              <Route path="matrix" element={<Matrix />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
