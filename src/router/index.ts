import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'library',
      component: () => import('@/views/LibraryPage.vue'),
    },
    {
      path: '/reader/:id',
      name: 'reader',
      component: () => import('@/views/ReaderPage.vue'),
      props: true,
      meta: { immersive: true },
    },
    {
      path: '/sync',
      name: 'sync',
      component: () => import('@/views/SyncPage.vue'),
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsPage.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})

export default router
