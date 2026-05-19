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
import { Modal } from '@douyinfe/semi-ui';

const EnableDisableUserModal = ({
  visible,
  onCancel,
  onConfirm,
  user,
  action,
  t,
}) => {
  const isDisable = action === 'disable';

  return (
    <Modal
      title={
        isDisable
          ? t('确定要禁用此用户吗？')
          : t('确定要启用此用户吗？')
      }
      visible={visible}
      onCancel={onCancel}
      onOk={onConfirm}
      type='warning'
    >
      <div className='space-y-2'>
        <div>
          {isDisable
            ? t('此操作将禁用用户账户')
            : t('此操作将启用用户账户')}
        </div>
        <div className='text-xs text-[var(--semi-color-text-2)]'>
          {isDisable
            ? t('本次禁用会增加用户封禁次数，封禁超过3次后将不再自动解封')
            : t('手动启用会保留用户封禁次数，但会清除自动解封时间')}
        </div>
      </div>
    </Modal>
  );
};

export default EnableDisableUserModal;
