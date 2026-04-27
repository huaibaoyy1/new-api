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
import { Typography, Space, Tag } from '@douyinfe/semi-ui';
import { IconUserAdd } from '@douyinfe/semi-icons';
import CompactModeToggle from '../../common/ui/CompactModeToggle';

const { Text } = Typography;

const UsersDescription = ({
  compactMode,
  setCompactMode,
  summary,
  t,
}) => {
  const stats = summary || {
    total_users: 0,
    consumed_users: 0,
    not_consumed_users: 0,
    checked_users: 0,
    not_checked_users: 0,
  };

  return (
    <div className='flex flex-col gap-2 w-full'>
      <div className='flex flex-col md:flex-row justify-between items-start md:items-center gap-2 w-full'>
        <div className='flex items-center text-blue-500'>
          <IconUserAdd className='mr-2' />
          <Text>{t('用户管理')}</Text>
        </div>
        <CompactModeToggle
          compactMode={compactMode}
          setCompactMode={setCompactMode}
          t={t}
        />
      </div>
      <Space wrap>
        <Tag color='blue' shape='circle'>
          {t('筛选后总人数')}: {stats.total_users || 0}
        </Tag>
        <Tag color='green' shape='circle'>
          {t('有消费人数')}: {stats.consumed_users || 0}
        </Tag>
        <Tag color='grey' shape='circle'>
          {t('无消费人数')}: {stats.not_consumed_users || 0}
        </Tag>
        <Tag color='green' shape='circle'>
          {t('已签到人数')}: {stats.checked_users || 0}
        </Tag>
        <Tag color='grey' shape='circle'>
          {t('未签到人数')}: {stats.not_checked_users || 0}
        </Tag>
      </Space>
    </div>
  );
};

export default UsersDescription;