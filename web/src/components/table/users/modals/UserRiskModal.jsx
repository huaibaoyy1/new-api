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

import React, { useMemo, useState } from 'react';
import { Button, Card, Modal, Space, Tag, Table, Typography } from '@douyinfe/semi-ui';
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
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [activePreviewRecord, setActivePreviewRecord] = useState(null);

  const previewMetaTags = useMemo(() => {
    if (!activePreviewRecord) {
      return [];
    }
    const tags = [];
    if (activePreviewRecord.request_preview_truncated) {
      tags.push(
        <Tag color='orange' key='truncated'>
          已截断
        </Tag>,
      );
    }
    if (activePreviewRecord.request_body_size > 0) {
      tags.push(
        <Tag color='white' key='size'>
          {`大小 ${activePreviewRecord.request_body_size} B`}
        </Tag>,
      );
    }
    if (activePreviewRecord.request_content_type) {
      tags.push(
        <Tag color='white' key='content-type'>
          {activePreviewRecord.request_content_type}
        </Tag>,
      );
    }
    return tags;
  }, [activePreviewRecord]);

  const openPreviewModal = (record) => {
    setActivePreviewRecord(record);
    setPreviewModalVisible(true);
  };

  const closePreviewModal = () => {
    setPreviewModalVisible(false);
    setActivePreviewRecord(null);
  };

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
      width: 360,
      render: (value, record) => {
        if (!value) {
          return '-';
        }
        const previewText =
          value.length > 280 ? `${value.slice(0, 280)}...` : value;
        return (
          <div className='max-w-[320px] text-xs leading-5'>
            <Typography.Paragraph
              style={{ marginBottom: 8 }}
              ellipsis={{
                rows: 4,
                showTooltip: false,
              }}
            >
              {previewText}
            </Typography.Paragraph>
            <div className='mb-2 flex flex-wrap gap-1'>
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
            <Button
              theme='borderless'
              type='primary'
              size='small'
              onClick={() => openPreviewModal(record)}
            >
              查看全文
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <>
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
              scroll={{ x: 1200 }}
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

      <Modal
        title='请求摘要全文'
        visible={previewModalVisible}
        onCancel={closePreviewModal}
        footer={null}
        width={820}
        centered
      >
        <div className='space-y-3'>
          <Space wrap spacing={8}>
            <Tag color='grey'>
              状态码：{activePreviewRecord?.status_code || '-'}
            </Tag>
            <Tag color='grey'>
              模型：{activePreviewRecord?.model_name || '-'}
            </Tag>
            <Tag color='grey'>
              渠道：{activePreviewRecord?.channel_name || activePreviewRecord?.channel_id || '-'}
            </Tag>
            {previewMetaTags}
          </Space>
          <Card bodyStyle={{ maxHeight: 480, overflowY: 'auto' }}>
            <Typography.Paragraph
              style={{
                marginBottom: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                fontSize: 12,
                lineHeight: 1.7,
              }}
            >
              {activePreviewRecord?.request_preview || '-'}
            </Typography.Paragraph>
          </Card>
        </div>
      </Modal>
    </>
  );
};

export default UserRiskModal;