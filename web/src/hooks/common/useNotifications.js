/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import { useState, useEffect } from 'react';

const NOTICE_READ_KEYS_STORAGE_KEY = 'notice_read_keys';

export const useNotifications = (statusState, userState) => {
  const [noticeVisible, setNoticeVisible] = useState(false);
  const [forceNotice, setForceNotice] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const announcements = statusState?.status?.announcements || [];
  const isLoggedIn = Boolean(userState?.user?.id);
  const forceAnnouncementEnabled =
    statusState?.status?.force_announcement_enabled ?? true;

  const getAnnouncementKey = (a) =>
    `${a?.id || ''}-${a?.publishDate || ''}-${(a?.content || '').slice(0, 30)}`;

  const getReadKeys = () => {
    try {
      const raw = localStorage.getItem(NOTICE_READ_KEYS_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const calculateUnreadCount = () => {
    if (!announcements.length) return 0;
    const readKeySet = new Set(getReadKeys());
    return announcements.filter((a) => !readKeySet.has(getAnnouncementKey(a))).length;
  };

  const getUnreadKeys = () => {
    if (!announcements.length) return [];
    const readKeySet = new Set(getReadKeys());
    return announcements
      .map(getAnnouncementKey)
      .filter((key) => !readKeySet.has(key));
  };

  useEffect(() => {
    const nextUnreadCount = calculateUnreadCount();
    setUnreadCount(nextUnreadCount);
    if (forceAnnouncementEnabled && nextUnreadCount > 0) {
      setForceNotice(isLoggedIn);
      setNoticeVisible(true);
    } else {
      setForceNotice(false);
    }
  }, [announcements, isLoggedIn, forceAnnouncementEnabled]);

  const handleNoticeOpen = () => {
    setForceNotice(false);
    setNoticeVisible(true);
  };

  const handleNoticeClose = () => {
    setNoticeVisible(false);
    setForceNotice(false);
    setUnreadCount(calculateUnreadCount());
  };

  return {
    noticeVisible,
    forceNotice,
    unreadCount,
    announcements,
    handleNoticeOpen,
    handleNoticeClose,
    getUnreadKeys,
  };
};
