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

import React from 'react';
import { Button, Popconfirm, Space, Typography } from '@douyinfe/semi-ui';

const UsersActions = ({
  setShowAddUser,
  exportActivityCSV,
  selectedUserIds,
  batchManageUsers,
  t,
}) => {
  // Add new user
  const handleAddUser = () => {
    setShowAddUser(true);
  };

  return (
    <div className='flex flex-col md:flex-row gap-2 w-full md:w-auto order-2 md:order-1'>
      <Button className='w-full md:w-auto' onClick={handleAddUser} size='small'>
        {t('添加用户')}
      </Button>
      <Button
        className='w-full md:w-auto'
        onClick={exportActivityCSV}
        size='small'
        type='secondary'
      >
        {t('导出 CSV')}
      </Button>
      <Space spacing={8} wrap>
        <Typography.Text type='secondary' size='small'>
          {t('已选 {{count}} 个用户', { count: selectedUserIds.length })}
        </Typography.Text>
        <Popconfirm
          title={t('确认批量禁用选中的用户吗？')}
          onConfirm={() => batchManageUsers('disable')}
        >
          <Button
            className='w-full md:w-auto'
            size='small'
            type='danger'
            disabled={!selectedUserIds.length}
          >
            {t('批量禁用')}
          </Button>
        </Popconfirm>
        <Popconfirm
          title={t('确认批量启用选中的用户吗？')}
          onConfirm={() => batchManageUsers('enable')}
        >
          <Button
            className='w-full md:w-auto'
            size='small'
            disabled={!selectedUserIds.length}
          >
            {t('批量启用')}
          </Button>
        </Popconfirm>
      </Space>
    </div>
  );
};

export default UsersActions;