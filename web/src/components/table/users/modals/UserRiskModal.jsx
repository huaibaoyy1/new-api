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
import { Modal, Card, Space, Tag, Table, Typography } from '@douyinfe/semi-ui';
import { renderNumber, timestamp2string, renderQuota } from '../../../../helpers';

const riskColorMap = {
  low: 'green',
  medium: 'orange',
  high: 'red',
};

const riskTextMap = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
};

const metricCardStyle = {
  minWidth: 120,
};

const UserRiskModal = ({
  visible,
  onCancel,
  user,
  summary,
  logs,
  loading,
  pagination,
  onPageChange,
  onPageSizeChange,
}) => {
  const columns = [
    {
      title: '时间',
      dataIndex: 'created_at',
      render: (value) => (value ? timestamp2string(value) : '-'),
    },
    {
      title: '状态码',
      dataIndex: 'status_code',
      render: (value) => (
        <Tag
          color={
            value >= 500 ? 'red' : value >= 400 ? 'orange' : 'green'
          }
          shape='circle'
        >
          {value || '-'}
        </Tag>
      ),
    },
    {
      title: '错误码',
      dataIndex: 'error_code',
      render: (value) => value || '-',
    },
    {
      title: '模型',
      dataIndex: 'model_name',
      render: (value) => value || '-',
    },
    {
      title: '渠道',
      dataIndex: 'channel_name',
      render: (_, record) => record.channel_name || record.channel_id || '-',
    },
    {
      title: 'Token',
      dataIndex: 'token_name',
      render: (value) => value || '-',
    },
    {
      title: '额度',
      dataIndex: 'quota',
      render: (value) => (value ? renderQuota(value) : '-'),
    },
    {
      title: '耗时(s)',
      dataIndex: 'use_time',
      render: (value) => value ?? '-',
    },
    {
      title: 'IP',
      dataIndex: 'ip',
      render: (value) => value || '-',
    },
    {
      title: '请求摘要',
      dataIndex: 'request_preview',
      render: (value, record) => {
        if (!value) {
          return '-';
        }
        return (
          <div className='max-w-[320px] whitespace-pre-wrap break-all text-xs leading-5'>
            <div>{value}</div>
            <div className='mt-1 flex flex-wrap gap-1'>
              {record.request_preview_truncated ? (
                <Tag color='orange' size='small'>
                  已截断
                </Tag>
              ) : null}
              {record.request_body_size > 0 ? (
                <Tag color='white' size='small'>
                  {`大小 ${record.request_body_size} B`}
                </Tag>
              ) : null}
              {record.request_content_type ? (
                <Tag color='white' size='small'>
                  {record.request_content_type}
                </Tag>
              ) : null}
            </div>
          </div>
        );
      },
    },
  ];

  return (
    <Modal
      title={`用户请求风险${user?.username ? ` - ${user.username}` : ''}`}
      visible={visible}
      onCancel={onCancel}
      footer={null}
      width={1100}
      centered
    >
      <div className='space-y-4'>
        <Space wrap spacing={12}>
          <Card style={metricCardStyle}>
            <Typography.Text type='tertiary'>风险等级</Typography.Text>
            <div className='mt-2'>
              <Tag
                color={riskColorMap[summary?.risk_level] || 'grey'}
                size='large'
                shape='circle'
              >
                {riskTextMap[summary?.risk_level] || '未知'}
              </Tag>
            </div>
          </Card>
          <Card style={metricCardStyle}>
            <Typography.Text type='tertiary'>总请求数</Typography.Text>
            <div className='mt-2 text-lg font-semibold'>
              {renderNumber(summary?.total_requests || 0)}
            </div>
          </Card>
          <Card style={metricCardStyle}>
            <Typography.Text type='tertiary'>成功数</Typography.Text>
            <div className='mt-2 text-lg font-semibold text-green-600'>
              {renderNumber(summary?.success_count || 0)}
            </div>
          </Card>
          <Card style={metricCardStyle}>
            <Typography.Text type='tertiary'>错误数</Typography.Text>
            <div className='mt-2 text-lg font-semibold text-red-600'>
              {renderNumber(summary?.error_count || 0)}
            </div>
          </Card>
          <Card style={metricCardStyle}>
            <Typography.Text type='tertiary'>错误率</Typography.Text>
            <div className='mt-2 text-lg font-semibold'>
              {Number(summary?.error_rate || 0).toFixed(2)}%
            </div>
          </Card>
        </Space>

        <Space wrap spacing={12}>
          <Tag color='green' size='large'>2xx: {summary?.status_2xx || 0}</Tag>
          <Tag color='orange' size='large'>4xx: {summary?.status_4xx || 0}</Tag>
          <Tag color='red' size='large'>5xx: {summary?.status_5xx || 0}</Tag>
          <Tag color='red' size='large'>401: {summary?.status_401 || 0}</Tag>
          <Tag color='red' size='large'>403: {summary?.status_403 || 0}</Tag>
          <Tag color='orange' size='large'>422: {summary?.status_422 || 0}</Tag>
          <Tag color='red' size='large'>429: {summary?.status_429 || 0}</Tag>
        </Space>

        <Card
          title='最近异常请求'
          bodyStyle={{ padding: 0 }}
        >
          <Table
            rowKey='id'
            dataSource={logs || []}
            columns={columns}
            loading={loading}
            pagination={{
              currentPage: (pagination?.page || 0) + 1,
              pageSize: pagination?.pageSize || 10,
              total: pagination?.total || 0,
              onPageChange: (page) => onPageChange?.(page - 1),
              onPageSizeChange: (size) => onPageSizeChange?.(size),
            }}
          />
        </Card>
      </div>
    </Modal>
  );
};

export default UserRiskModal;