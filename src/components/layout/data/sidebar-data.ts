import {
  AudioWaveform,
  Command,
  GalleryVerticalEnd,
  LayoutDashboard,
  ListChecks,
  Package,
  MessageSquare,
  Users,
  Lock,
  Bug,
  ShieldOff,
  FileX,
  ServerCrash,
  Wrench,
  Palette,
  Bell,
  Monitor,
  HelpCircle,
} from 'lucide-react'

import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: {
    name: 'satnaing',
    email: 'satnaingdev@gmail.com',
    avatar: '/avatars/shadcn.jpg',
  },
  teams: [
    {
      name: 'Shadcn Admin',
      logo: Command,
      plan: 'Vite + ShadcnUI',
    },
    {
      name: 'Acme Inc',
      logo: GalleryVerticalEnd,
      plan: 'Enterprise',
    },
    {
      name: 'Acme Corp.',
      logo: AudioWaveform,
      plan: 'Startup',
    },
  ],
  navGroups: [
    {
      title: 'General',
      items: [
        {
          title: 'Dashboard',
          url: '/',
          icon: LayoutDashboard,
        },
        {
          title: 'Tasks',
          url: '/tasks',
          icon: ListChecks,
        },
        {
          title: 'Apps',
          url: '/apps',
          icon: Package,
        },
        {
          title: 'Chats',
          url: '/chats',
          badge: '3',
          icon: MessageSquare,
        },
        {
          title: 'Users',
          url: '/users',
          icon: Users,
        },
      ],
    },
    {
      title: 'Pages',
      items: [
        {
          title: 'Auth',
          icon: Lock,
          items: [
            {
              title: 'Sign In',
              url: '/sign-in',
              icon: Lock,
            },
            {
              title: 'Sign In (2 Col)',
              url: '/sign-in-2',
              icon: Lock,
            },
            {
              title: 'Sign Up',
              url: '/sign-up',
              icon: Lock,
            },
            {
              title: 'Forgot Password',
              url: '/forgot-password',
              icon: Lock,
            },
            {
              title: 'OTP',
              url: '/otp',
              icon: Lock,
            },
          ],
        },
        {
          title: 'Errors',
          icon: Bug,
          items: [
            {
              title: 'Unauthorized',
              url: '/401',
              icon: ShieldOff,
            },
            {
              title: 'Forbidden',
              url: '/403',
              icon: ShieldOff,
            },
            {
              title: 'Not Found',
              url: '/404',
              icon: FileX,
            },
            {
              title: 'Internal Server Error',
              url: '/500',
              icon: ServerCrash,
            },
            {
              title: 'Maintenance Error',
              url: '/503',
              icon: Wrench,
            },
          ],
        },
      ],
    },
    {
      title: 'Other',
      items: [
        {
          title: 'Settings',
          icon: Wrench,
          items: [
            {
              title: 'Profile',
              url: '/settings',
              icon: Users,
            },
            {
              title: 'Account',
              url: '/settings/account',
              icon: Wrench,
            },
            {
              title: 'Appearance',
              url: '/settings/appearance',
              icon: Palette,
            },
            {
              title: 'Notifications',
              url: '/settings/notifications',
              icon: Bell,
            },
            {
              title: 'Display',
              url: '/settings/display',
              icon: Monitor,
            },
          ],
        },
        {
          title: 'Help Center',
          url: '/help-center',
          icon: HelpCircle,
        },
      ],
    },
  ],
}
