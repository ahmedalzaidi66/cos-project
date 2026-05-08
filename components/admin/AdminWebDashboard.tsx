import React from 'react';
import AdminWebLayout from '@/components/admin/AdminWebLayout';

type Props = {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  showQuickNav?: boolean;
  noScroll?: boolean;
  children: React.ReactNode;
};

export default function AdminWebDashboard({ title, subtitle, noScroll, children }: Props) {
  return (
    <AdminWebLayout title={title} subtitle={subtitle} noScroll={noScroll}>
      {children}
    </AdminWebLayout>
  );
}
