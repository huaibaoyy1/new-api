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
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess } from '../../helpers';
import { ITEMS_PER_PAGE } from '../../constants';
import { useTableCompactMode } from '../common/useTableCompactMode';

export const useUsersData = () => {
  const { t } = useTranslation();
  const [compactMode, setCompactMode] = useTableCompactMode('users');

  // State management
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState(1);
  const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE);
  const [searching, setSearching] = useState(false);
  const [groupOptions, setGroupOptions] = useState([]);
  const [userCount, setUserCount] = useState(0);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [activityFilters, setActivityFilters] = useState({
    days: 1,
    consumeStatus: 'all',
    checkinStatus: 'all',
    userStatus: 0,
    riskLevel: 'all',
    minErrorRate: 0,
    minStatus429: 0,
  });
  const [activitySummary, setActivitySummary] = useState({
    total_users: 0,
    consumed_users: 0,
    not_consumed_users: 0,
    checked_users: 0,
    not_checked_users: 0,
  });
  const [showUserRiskModal, setShowUserRiskModal] = useState(false);
  const [riskUser, setRiskUser] = useState(null);
  const [riskSummary, setRiskSummary] = useState(null);
  const [riskLogs, setRiskLogs] = useState([]);
  const [riskLoading, setRiskLoading] = useState(false);
  const [riskPagination, setRiskPagination] = useState({
    page: 0,
    pageSize: 10,
    total: 0,
  });

  // Modal states
  const [showAddUser, setShowAddUser] = useState(false);
  const [showEditUser, setShowEditUser] = useState(false);
  const [editingUser, setEditingUser] = useState({
    id: undefined,
  });

  // Form initial values
  const formInitValues = {
    searchKeyword: '',
    searchGroup: '',
    activityDays: 1,
    consumeStatus: 'all',
    checkinStatus: 'all',
    userStatus: 0,
    riskLevel: 'all',
    minErrorRate: 0,
    minStatus429: 0,
  };

  // Form API reference
  const [formApi, setFormApi] = useState(null);

  // Get form values helper function
  const getFormValues = () => {
    const formValues = formApi ? formApi.getValues() : {};
    return {
      searchKeyword: formValues.searchKeyword || '',
      searchGroup: formValues.searchGroup || '',
      activityDays: Number(formValues.activityDays || 1),
      consumeStatus: formValues.consumeStatus || 'all',
      checkinStatus: formValues.checkinStatus || 'all',
      userStatus: Number(formValues.userStatus || 0),
      riskLevel: formValues.riskLevel || 'all',
      minErrorRate: Number(formValues.minErrorRate || 0),
      minStatus429: Number(formValues.minStatus429 || 0),
    };
  };

  const loadActivitySummary = async (
    searchKeyword = '',
    searchGroup = '',
    filters = activityFilters,
  ) => {
    try {
      const res = await API.get(
        `/api/user/activity_summary?keyword=${searchKeyword}&group=${searchGroup}&days=${filters.days}&consume_status=${filters.consumeStatus}&checkin_status=${filters.checkinStatus}&user_status=${filters.userStatus || 0}&risk_level=${filters.riskLevel || 'all'}&min_error_rate=${filters.minErrorRate || 0}&min_status_429=${filters.minStatus429 || 0}`,
      );
      const { success, message, data } = res.data;
      if (success) {
        setActivitySummary(
          data || {
            total_users: 0,
            consumed_users: 0,
            not_consumed_users: 0,
            checked_users: 0,
            not_checked_users: 0,
          },
        );
      } else {
        showError(message);
      }
    } catch (error) {
      showError(error.message);
    }
  };

  // Set user format with key field
  const setUserFormat = (users) => {
    for (let i = 0; i < users.length; i++) {
      users[i].key = users[i].id;
    }
    setUsers(users);
  };

  // Load users data
  const loadUsers = async (startIdx, pageSize, nextFilters = null) => {
    setLoading(true);
    const filters = nextFilters || activityFilters;
    setActivityFilters(filters);
    const res = await API.get(
      `/api/user/?p=${startIdx}&page_size=${pageSize}&days=${filters.days}&consume_status=${filters.consumeStatus}&checkin_status=${filters.checkinStatus}&user_status=${filters.userStatus || 0}&risk_level=${filters.riskLevel || 'all'}&min_error_rate=${filters.minErrorRate || 0}&min_status_429=${filters.minStatus429 || 0}`,
    );
    const { success, message, data } = res.data;
    if (success) {
      const newPageData = data.items;
      setActivePage(data.page);
      setUserCount(data.total);
      setUserFormat(newPageData);
      await loadActivitySummary('', '', filters);
    } else {
      showError(message);
    }
    setLoading(false);
  };

  // Search users with keyword and group
  const searchUsers = async (
    startIdx,
    pageSize,
    searchKeyword = null,
    searchGroup = null,
    nextFilters = null,
  ) => {
    let filters = nextFilters;
    // If no parameters passed, get values from form
    if (searchKeyword === null || searchGroup === null || nextFilters === null) {
      const formValues = getFormValues();
      searchKeyword = searchKeyword === null ? formValues.searchKeyword : searchKeyword;
      searchGroup = searchGroup === null ? formValues.searchGroup : searchGroup;
      filters = nextFilters || {
        days: formValues.activityDays,
        consumeStatus: formValues.consumeStatus,
        checkinStatus: formValues.checkinStatus,
        userStatus: formValues.userStatus,
        riskLevel: formValues.riskLevel,
        minErrorRate: formValues.minErrorRate,
        minStatus429: formValues.minStatus429,
      };
    }

    setActivityFilters(filters);

    if (searchKeyword === '' && searchGroup === '') {
      await loadUsers(startIdx, pageSize, filters);
      return;
    }
    setSearching(true);
    const res = await API.get(
      `/api/user/search?keyword=${searchKeyword}&group=${searchGroup}&p=${startIdx}&page_size=${pageSize}&days=${filters.days}&consume_status=${filters.consumeStatus}&checkin_status=${filters.checkinStatus}&user_status=${filters.userStatus || 0}&risk_level=${filters.riskLevel || 'all'}&min_error_rate=${filters.minErrorRate || 0}&min_status_429=${filters.minStatus429 || 0}`,
    );
    const { success, message, data } = res.data;
    if (success) {
      const newPageData = data.items;
      setActivePage(data.page);
      setUserCount(data.total);
      setUserFormat(newPageData);
      await loadActivitySummary(searchKeyword, searchGroup, filters);
    } else {
      showError(message);
    }
    setSearching(false);
  };

  // Manage user operations (promote, demote, enable, disable, delete)
  const manageUser = async (userId, action, record) => {
    // Trigger loading state to force table re-render
    setLoading(true);

    const res = await API.post('/api/user/manage', {
      id: userId,
      action,
    });

    const { success, message } = res.data;
    if (success) {
      showSuccess(t('操作成功完成！'));
      const user = res.data.data;

      // Create a new array and new object to ensure React detects changes
      const newUsers = users.map((u) => {
        if (u.id === userId) {
          if (action === 'delete') {
            return { ...u, DeletedAt: new Date() };
          }
          return { ...u, status: user.status, role: user.role };
        }
        return u;
      });

      setUsers(newUsers);
    } else {
      showError(message);
    }

    setLoading(false);
  };

  const resetUserPasskey = async (user) => {
    if (!user) {
      return;
    }
    try {
      const res = await API.delete(`/api/user/${user.id}/reset_passkey`);
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('Passkey 已重置'));
      } else {
        showError(message || t('操作失败，请重试'));
      }
    } catch (error) {
      showError(t('操作失败，请重试'));
    }
  };

  const resetUserTwoFA = async (user) => {
    if (!user) {
      return;
    }
    try {
      const res = await API.delete(`/api/user/${user.id}/2fa`);
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('二步验证已重置'));
      } else {
        showError(message || t('操作失败，请重试'));
      }
    } catch (error) {
      showError(t('操作失败，请重试'));
    }
  };

  // Handle page change
  const handlePageChange = (page) => {
    setActivePage(page);
    const {
      searchKeyword,
      searchGroup,
      activityDays,
      consumeStatus,
      checkinStatus,
      userStatus,
      riskLevel,
      minErrorRate,
      minStatus429,
    } = getFormValues();
    const filters = {
      days: activityDays,
      consumeStatus,
      checkinStatus,
      userStatus,
      riskLevel,
      minErrorRate,
      minStatus429,
    };
    if (searchKeyword === '' && searchGroup === '') {
      loadUsers(page, pageSize, filters).then();
    } else {
      searchUsers(page, pageSize, searchKeyword, searchGroup, filters).then();
    }
  };

  // Handle page size change
  const handlePageSizeChange = async (size) => {
    localStorage.setItem('page-size', size + '');
    setPageSize(size);
    setActivePage(1);
    loadUsers(activePage, size, activityFilters)
      .then()
      .catch((reason) => {
        showError(reason);
      });
  };

  // Handle table row styling for disabled/deleted users
  const handleRow = (record, index) => {
    if (record.DeletedAt !== null || record.status !== 1) {
      return {
        style: {
          background: 'var(--semi-color-disabled-border)',
        },
      };
    } else {
      return {};
    }
  };

  const batchManageUsers = async (action) => {
    if (!selectedUserIds.length) {
      showError(t('请先选择用户'));
      return false;
    }
    try {
      const res = await API.post('/api/user/manage_batch', {
        ids: selectedUserIds,
        action,
      });
      const { success, message, data } = res.data;
      if (success) {
        showSuccess(
          t('批量操作成功，已处理 {{count}} 个用户', {
            count: data?.count || 0,
          }),
        );
        setSelectedUserIds([]);
        await refresh();
        return true;
      } else {
        showError(message);
      }
    } catch (error) {
      showError(error.message);
    }
    return false;
  };

  const exportActivityCSV = async () => {
    const {
      searchKeyword,
      searchGroup,
      activityDays,
      consumeStatus,
      checkinStatus,
      userStatus,
      riskLevel,
      minErrorRate,
      minStatus429,
    } = getFormValues();
    try {
      const res = await API.get('/api/user/activity_export', {
        params: {
          keyword: searchKeyword || '',
          group: searchGroup || '',
          days: String(activityDays || 1),
          consume_status: consumeStatus || 'all',
          checkin_status: checkinStatus || 'all',
          user_status: String(userStatus || 0),
          risk_level: riskLevel || 'all',
          min_error_rate: String(minErrorRate || 0),
          min_status_429: String(minStatus429 || 0),
        },
        responseType: 'blob',
      });

      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const contentDisposition = res.headers['content-disposition'] || '';
      const match = contentDisposition.match(/filename="?([^"]+)"?/);
      link.href = url;
      link.download = match?.[1] || `users_activity_${activityDays || 1}d.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      showError(error.message);
    }
  };

  const loadUserRiskDetail = async (
    user,
    page = 0,
    pageSize = riskPagination.pageSize,
  ) => {
    if (!user?.id) return;
    const { activityDays } = getFormValues();
    setRiskLoading(true);
    try {
      const [summaryRes, logsRes] = await Promise.all([
        API.get(`/api/user/${user.id}/request_risk`, {
          params: {
            days: activityDays || 1,
          },
        }),
        API.get(`/api/user/${user.id}/request_risk_logs`, {
          params: {
            days: activityDays || 1,
            p: page,
            page_size: pageSize,
          },
        }),
      ]);

      if (summaryRes.data.success) {
        setRiskSummary(summaryRes.data.data);
      } else {
        showError(summaryRes.data.message);
      }

      if (logsRes.data.success) {
        setRiskLogs(logsRes.data.data?.items || []);
        setRiskPagination({
          page,
          pageSize,
          total: logsRes.data.data?.total || 0,
        });
      } else {
        showError(logsRes.data.message);
      }
    } catch (error) {
      showError(error.message);
    } finally {
      setRiskLoading(false);
    }
  };

  const openUserRiskModal = async (user) => {
    setRiskUser(user);
    setShowUserRiskModal(true);
    await loadUserRiskDetail(user, 0, riskPagination.pageSize);
  };

  const closeUserRiskModal = () => {
    setShowUserRiskModal(false);
    setRiskUser(null);
    setRiskSummary(null);
    setRiskLogs([]);
    setRiskPagination({
      page: 0,
      pageSize: 10,
      total: 0,
    });
  };

  // Refresh data
  const refresh = async (page = activePage) => {
    const {
      searchKeyword,
      searchGroup,
      activityDays,
      consumeStatus,
      checkinStatus,
      userStatus,
      riskLevel,
      minErrorRate,
      minStatus429,
    } = getFormValues();
    const filters = {
      days: activityDays,
      consumeStatus,
      checkinStatus,
      userStatus,
      riskLevel,
      minErrorRate,
      minStatus429,
    };
    if (searchKeyword === '' && searchGroup === '') {
      await loadUsers(page, pageSize, filters);
    } else {
      await searchUsers(page, pageSize, searchKeyword, searchGroup, filters);
    }
  };

  // Fetch groups data
  const fetchGroups = async () => {
    try {
      let res = await API.get(`/api/group/`);
      if (res === undefined) {
        return;
      }
      setGroupOptions(
        res.data.data.map((group) => ({
          label: group,
          value: group,
        })),
      );
    } catch (error) {
      showError(error.message);
    }
  };

  // Modal control functions
  const closeAddUser = () => {
    setShowAddUser(false);
  };

  const closeEditUser = () => {
    setShowEditUser(false);
    setEditingUser({
      id: undefined,
    });
  };

  // Initialize data on component mount
  useEffect(() => {
    loadUsers(0, pageSize, activityFilters)
      .then()
      .catch((reason) => {
        showError(reason);
      });
    fetchGroups().then();
  }, []);

  return {
    // Data state
    users,
    loading,
    activePage,
    pageSize,
    userCount,
    selectedUserIds,
    searching,
    groupOptions,
    activityFilters,
    activitySummary,
    setActivityFilters,
    setSelectedUserIds,

    // Modal state
    showAddUser,
    showEditUser,
    editingUser,
    showUserRiskModal,
    riskUser,
    riskSummary,
    riskLogs,
    riskLoading,
    riskPagination,
    setShowAddUser,
    setShowEditUser,
    setEditingUser,

    // Form state
    formInitValues,
    formApi,
    setFormApi,

    // UI state
    compactMode,
    setCompactMode,

    // Actions
    loadUsers,
    searchUsers,
    manageUser,
    resetUserPasskey,
    resetUserTwoFA,
    handlePageChange,
    handlePageSizeChange,
    handleRow,
    refresh,
    closeAddUser,
    closeEditUser,
    getFormValues,
    loadActivitySummary,
    exportActivityCSV,
    batchManageUsers,
    openUserRiskModal,
    closeUserRiskModal,
    loadUserRiskDetail,

    // Translation
    t,
  };
};