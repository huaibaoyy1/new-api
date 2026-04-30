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

import React, { useRef } from 'react';
import { Form, Button } from '@douyinfe/semi-ui';
import { IconSearch } from '@douyinfe/semi-icons';

const UsersFilters = ({
  formInitValues,
  setFormApi,
  searchUsers,
  loadUsers,
  activePage,
  pageSize,
  groupOptions,
  loading,
  searching,
  t,
}) => {
  const formApiRef = useRef(null);

  const handleReset = () => {
    if (!formApiRef.current) return;
    formApiRef.current.reset();
    setTimeout(() => {
      loadUsers(1, pageSize);
    }, 100);
  };

  return (
    <Form
      initValues={formInitValues}
      getFormApi={(api) => {
        setFormApi(api);
        formApiRef.current = api;
      }}
      onSubmit={() => {
        searchUsers(1, pageSize);
      }}
      allowEmpty={true}
      autoComplete='off'
      layout='horizontal'
      trigger='change'
      stopValidateWithError={false}
      className='w-full md:w-auto order-1 md:order-2'
    >
      <div className='flex w-full flex-col gap-2'>
        <div className='flex flex-wrap items-end gap-2'>
          <div className='min-w-[280px] flex-1'>
            <div className='mb-1 text-xs text-[var(--semi-color-text-2)]'>{t('关键词')}</div>
            <Form.Input
              field='searchKeyword'
              prefix={<IconSearch />}
              placeholder={t('搜索 ID / 用户名 / 显示名称 / 邮箱')}
              showClear
              pure
              size='small'
            />
          </div>
          <div className='w-[88px]'>
            <div className='mb-1 text-xs text-[var(--semi-color-text-2)]'>{t('统计天数')}</div>
            <Form.InputNumber
              field='activityDays'
              placeholder={t('天数')}
              min={1}
              max={3650}
              pure
              size='small'
            />
          </div>
          <div className='w-[150px]'>
            <div className='mb-1 text-xs text-[var(--semi-color-text-2)]'>{t('分组')}</div>
            <Form.Select
              field='searchGroup'
              placeholder={t('选择分组')}
              optionList={groupOptions}
              onChange={() => {
                setTimeout(() => {
                  searchUsers(1, pageSize);
                }, 100);
              }}
              className='w-full'
              showClear
              pure
              size='small'
            />
          </div>
          <div className='w-[140px]'>
            <div className='mb-1 text-xs text-[var(--semi-color-text-2)]'>{t('消费状态')}</div>
            <Form.Select
              field='consumeStatus'
              placeholder={t('消费状态')}
              optionList={[
                { label: t('全部消费'), value: 'all' },
                { label: t('有消费'), value: 'consumed' },
                { label: t('无消费'), value: 'not_consumed' },
              ]}
              className='w-full'
              pure
              size='small'
            />
          </div>
          <div className='w-[140px]'>
            <div className='mb-1 text-xs text-[var(--semi-color-text-2)]'>{t('签到状态')}</div>
            <Form.Select
              field='checkinStatus'
              placeholder={t('签到状态')}
              optionList={[
                { label: t('全部签到'), value: 'all' },
                { label: t('已签到'), value: 'checked' },
                { label: t('未签到'), value: 'not_checked' },
              ]}
              className='w-full'
              pure
              size='small'
            />
          </div>
          <div className='flex gap-2'>
            <Button
              type='tertiary'
              htmlType='submit'
              loading={loading || searching}
              size='small'
            >
              {t('查询')}
            </Button>
            <Button
              type='tertiary'
              onClick={handleReset}
              size='small'
            >
              {t('重置')}
            </Button>
          </div>
        </div>

        <div className='flex flex-wrap items-end gap-2 rounded-lg bg-[var(--semi-color-fill-0)] px-3 py-2'>
          <div className='mr-2 text-xs text-[var(--semi-color-text-2)]'>
            {t('高级筛选')}
          </div>
          <div className='w-[140px]'>
            <div className='mb-1 text-xs text-[var(--semi-color-text-2)]'>{t('用户状态')}</div>
            <Form.Select
              field='userStatus'
              placeholder={t('用户状态')}
              optionList={[
                { label: t('全部状态'), value: 0 },
                { label: t('已启用'), value: 1 },
                { label: t('已禁用'), value: 2 },
              ]}
              className='w-full'
              pure
              size='small'
            />
          </div>
          <div className='w-[140px]'>
            <div className='mb-1 text-xs text-[var(--semi-color-text-2)]'>{t('请求风险')}</div>
            <Form.Select
              field='riskLevel'
              placeholder={t('请求风险')}
              optionList={[
                { label: t('全部风险'), value: 'all' },
                { label: t('低风险'), value: 'low' },
                { label: t('中风险'), value: 'medium' },
                { label: t('高风险'), value: 'high' },
              ]}
              className='w-full'
              pure
              size='small'
            />
          </div>
          <div className='w-[120px]'>
            <div className='mb-1 text-xs text-[var(--semi-color-text-2)]'>{t('最小错误率')}</div>
            <Form.InputNumber
              field='minErrorRate'
              placeholder={t('支持 0.2')}
              min={0}
              max={100}
              pure
              size='small'
            />
          </div>
          <div className='w-[120px]'>
            <div className='mb-1 text-xs text-[var(--semi-color-text-2)]'>{t('最少429次数')}</div>
            <Form.InputNumber
              field='minStatus429'
              placeholder={t('例如 5')}
              min={0}
              pure
              size='small'
            />
          </div>
        </div>
      </div>
    </Form>
  );
};

export default UsersFilters;