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

import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Descriptions,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import CardPro from '../../components/common/ui/CardPro';
import { API, showError, showSuccess } from '../../helpers';
import { renderQuota, getQuotaWithUnit, renderUnitWithQuota } from '../../helpers/render';
import { formatDateTimeString } from '../../helpers/utils';
import { useIsMobile } from '../../hooks/common/useIsMobile';

const toFormValues = (record = {}) => ({
  ...DEFAULT_FORM,
  ...record,
  run_time: record?.run_time || DEFAULT_FORM.run_time,
  min_consume_amount: record?.min_consume_quota
    ? Number(getQuotaWithUnit(record.min_consume_quota))
    : 0,
  reward_amount: record?.reward_quota
    ? Number(getQuotaWithUnit(record.reward_quota))
    : Number(getQuotaWithUnit(DEFAULT_FORM.reward_quota)),
});

const DEFAULT_FORM = {
  name: '',
  enabled: true,
  days: 1,
  consume_status: 'consumed',
  min_consume_quota: 0,
  min_consume_amount: 0,
  checkin_status: 'all',
  group: '',
  keyword: '',
  run_time: '23:50',
  winner_count: 1,
  reward_quota: 500000,
  reward_amount: 0,
  repeat_win_block_days: 7,
  reason: '',
};

const formatQuotaSummary = (quota) => {
  const rawQuota = Number(quota || 0);
  return `${renderQuota(rawQuota, 6)}（原生额度: ${rawQuota}）`;
};

const formatQuotaParts = (quota) => {
  const rawQuota = Number(quota || 0);
  return {
    display: renderQuota(rawQuota, 6),
    raw: rawQuota,
  };
};

const consumeStatusMap = {
  all: '全部消费',
  consumed: '已消费',
  not_consumed: '未消费',
};

const checkinStatusMap = {
  all: '全部签到',
  checked: '已签到',
  not_checked: '未签到',
};

const mergeLiveFormValues = (prevValues, firstArg, secondArg) => {
  const nextValues = { ...prevValues };
  if (firstArg && typeof firstArg === 'object' && !Array.isArray(firstArg)) {
    Object.assign(nextValues, firstArg);
  }
  if (secondArg && typeof secondArg === 'object' && !Array.isArray(secondArg)) {
    Object.assign(nextValues, secondArg);
  }
  return nextValues;
};

const LotteryPage = () => {
  const isMobile = useIsMobile();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);
  const [formApi, setFormApi] = useState(null);
  const [liveFormValues, setLiveFormValues] = useState(toFormValues());

  const [showRunsModal, setShowRunsModal] = useState(false);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runsData, setRunsData] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [runsPagination, setRunsPagination] = useState({
    page: 0,
    pageSize: 10,
    total: 0,
  });

  const [showWinnersModal, setShowWinnersModal] = useState(false);
  const [winnersLoading, setWinnersLoading] = useState(false);
  const [winnersData, setWinnersData] = useState([]);
  const [winnerRunId, setWinnerRunId] = useState(0);
  const [winnersPagination, setWinnersPagination] = useState({
    page: 0,
    pageSize: 10,
    total: 0,
  });

  const loadActivities = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/lottery/activities');
      const { success, data, message } = res.data;
      if (success) {
        setActivities(Array.isArray(data) ? data : []);
      } else {
        showError(message);
      }
    } catch (error) {
      showError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, []);

  const openCreateModal = () => {
    setEditingActivity(null);
    setLiveFormValues(toFormValues());
    setShowEditModal(true);
  };

  const openEditModal = (record) => {
    setEditingActivity(record);
    setLiveFormValues(toFormValues(record));
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingActivity(null);
    setLiveFormValues(toFormValues());
    formApi?.reset();
  };

  const handleSubmitActivity = async (values) => {
    setSubmitting(true);
    try {
      const mergedValues = {
        ...liveFormValues,
        ...values,
      };
      const rewardQuota = Math.round(
        renderUnitWithQuota(Number(mergedValues.reward_amount || 0)),
      );
      const minConsumeQuota =
        mergedValues.consume_status === 'not_consumed'
          ? 0
          : Math.round(
              renderUnitWithQuota(Number(mergedValues.min_consume_amount || 0)),
            );

      const payload = {
        ...mergedValues,
        run_time: String(mergedValues.run_time || '').trim(),
        reward_quota: rewardQuota,
        min_consume_quota: minConsumeQuota,
      };
      delete payload.reward_amount;
      delete payload.min_consume_amount;

      let res;
      if (editingActivity?.id) {
        res = await API.put(`/api/lottery/activities/${editingActivity.id}`, payload);
      } else {
        res = await API.post('/api/lottery/activities', payload);
      }

      const { success, message } = res.data;
      if (success) {
        showSuccess(editingActivity?.id ? '活动更新成功' : '活动创建成功');
        closeEditModal();
        loadActivities();
      } else {
        showError(message);
      }
    } catch (error) {
      showError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (record) => {
    Modal.confirm({
      title: '确认删除活动',
      content: `确定删除活动【${record.name}】吗？`,
      okText: '删除',
      okButtonProps: { type: 'danger' },
      onOk: async () => {
        try {
          const res = await API.delete(`/api/lottery/activities/${record.id}`);
          if (res.data.success) {
            showSuccess('活动已删除');
            loadActivities();
          } else {
            showError(res.data.message);
          }
        } catch (error) {
          showError(error.message);
        }
      },
    });
  };

  const handleToggle = async (record, enabled) => {
    try {
      const res = await API.post(`/api/lottery/activities/${record.id}/toggle`, {
        enabled,
      });
      if (res.data.success) {
        showSuccess(enabled ? '活动已启用' : '活动已停用');
        loadActivities();
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(error.message);
    }
  };

  const handleRunNow = (record) => {
    Modal.confirm({
      title: '确认立即执行',
      content: `将立即执行活动【${record.name}】，随机抽取 ${record.winner_count} 人，每人奖励 ${formatQuotaSummary(record.reward_quota)}。是否继续？`,
      okText: '立即执行',
      onOk: async () => {
        try {
          const res = await API.post(`/api/lottery/activities/${record.id}/run`);
          const { success, data, message } = res.data;
          if (success) {
            showSuccess(data?.message || '执行成功');
            loadActivities();
          } else {
            showError(message);
          }
        } catch (error) {
          showError(error.message);
        }
      },
    });
  };

  const loadRuns = async (activity, page = runsPagination.page, pageSize = runsPagination.pageSize) => {
    if (!activity?.id) return;
    setRunsLoading(true);
    try {
      const res = await API.get(`/api/lottery/activities/${activity.id}/runs`, {
        params: {
          p: page,
          page_size: pageSize,
        },
      });
      const { success, data, message } = res.data;
      if (success) {
        setRunsData(data?.items || []);
        setRunsPagination({
          page,
          pageSize,
          total: data?.total || 0,
        });
      } else {
        showError(message);
      }
    } catch (error) {
      showError(error.message);
    } finally {
      setRunsLoading(false);
    }
  };

  const openRunsModal = (activity) => {
    setSelectedActivity(activity);
    setShowRunsModal(true);
    loadRuns(activity, 0, runsPagination.pageSize);
  };

  const loadWinners = async (
    activity,
    page = winnersPagination.page,
    pageSize = winnersPagination.pageSize,
    runId = winnerRunId,
  ) => {
    if (!activity?.id) return;
    setWinnersLoading(true);
    try {
      const params = {
        p: page,
        page_size: pageSize,
      };
      if (runId > 0) {
        params.run_id = runId;
      }
      const res = await API.get(`/api/lottery/activities/${activity.id}/winners`, {
        params,
      });
      const { success, data, message } = res.data;
      if (success) {
        setWinnersData(data?.items || []);
        setWinnersPagination({
          page,
          pageSize,
          total: data?.total || 0,
        });
      } else {
        showError(message);
      }
    } catch (error) {
      showError(error.message);
    } finally {
      setWinnersLoading(false);
    }
  };

  const openWinnersModal = (activity) => {
    setSelectedActivity(activity);
    setWinnerRunId(0);
    setShowWinnersModal(true);
    loadWinners(activity, 0, winnersPagination.pageSize, 0);
  };

  const activityColumns = useMemo(
    () => [
      {
        title: '活动名称',
        dataIndex: 'name',
        render: (text) => <Typography.Text strong>{text}</Typography.Text>,
      },
      {
        title: '状态',
        dataIndex: 'enabled',
        render: (value) => (
          <Tag color={value ? 'green' : 'grey'}>
            {value ? '已启用' : '已停用'}
          </Tag>
        ),
      },
      {
        title: '执行时间',
        dataIndex: 'run_time',
      },
      {
        title: '筛选条件',
        render: (_, record) => (
          <div className='flex flex-wrap gap-2'>
            <Tag color='blue'>{`最近 ${record.days} 天`}</Tag>
            <Tag color='grey'>
              {consumeStatusMap[record.consume_status] || record.consume_status}
            </Tag>
            <Tag color='grey'>
              {checkinStatusMap[record.checkin_status] || record.checkin_status}
            </Tag>
            {record.min_consume_quota > 0 ? (
              <Tag color='orange'>
                {`最低消费 ${formatQuotaParts(record.min_consume_quota).display}`}
              </Tag>
            ) : null}
            {record.group ? <Tag color='purple'>{`分组 ${record.group}`}</Tag> : null}
          </div>
        ),
      },
      {
        title: '中奖规则',
        render: (_, record) => {
          const rewardQuota = formatQuotaParts(record.reward_quota);
          return (
            <div className='space-y-1'>
              <div className='text-[13px] font-medium text-gray-800 dark:text-gray-100'>
                {`中奖人数 ${record.winner_count}`}
              </div>
              <div className='text-[13px] text-gray-700 dark:text-gray-200'>
                {`奖励金额 ${rewardQuota.display}`}
              </div>
              <div className='text-[12px] text-gray-500 dark:text-gray-400'>
                {`原生额度 ${rewardQuota.raw}`}
              </div>
              <div className='text-[12px] text-gray-500 dark:text-gray-400'>
                {`重复限制 ${record.repeat_win_block_days} 天`}
              </div>
            </div>
          );
        },
      },
      {
        title: '最近执行',
        render: (_, record) => {
          if (!record.last_run_at) {
            return (
              <Typography.Text type='tertiary'>
                暂无记录
              </Typography.Text>
            );
          }
          const timeText = formatDateTimeString(new Date(record.last_run_at * 1000));
          const [datePart, timePart] = String(timeText).split(' ');
          return (
            <div className='space-y-1'>
              <div className='text-[13px] font-medium text-gray-800 dark:text-gray-100'>
                {datePart}
              </div>
              <div className='text-[12px] text-gray-500 dark:text-gray-400'>
                {timePart || ''}
              </div>
            </div>
          );
        },
      },
      {
        title: '操作',
        render: (_, record) => (
          <div className='flex flex-wrap items-center gap-2'>
            <Switch
              checked={record.enabled}
              onChange={(checked) => handleToggle(record, checked)}
              size='small'
            />
            <Button size='small' onClick={() => openEditModal(record)}>
              编辑
            </Button>
            <Button size='small' type='primary' onClick={() => handleRunNow(record)}>
              立即执行
            </Button>
            <Button size='small' onClick={() => openRunsModal(record)}>
              执行记录
            </Button>
            <Button size='small' onClick={() => openWinnersModal(record)}>
              中奖名单
            </Button>
            <Button size='small' type='danger' theme='borderless' onClick={() => handleDelete(record)}>
              删除
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  const runColumns = [
    { title: '批次 ID', dataIndex: 'id' },
    { title: '执行日期', dataIndex: 'run_date' },
    {
      title: '执行时间',
      render: (_, record) =>
        record.run_at ? formatDateTimeString(new Date(record.run_at * 1000)) : '-',
    },
    { title: '候选人数', dataIndex: 'candidate_count' },
    { title: '中奖人数', dataIndex: 'winner_count' },
    { title: '奖励额度', dataIndex: 'reward_quota' },
    {
      title: '触发方式',
      dataIndex: 'trigger_type',
      render: (value) => (
        <Tag color={value === 'manual' ? 'blue' : 'purple'}>
          {value === 'manual' ? '手动' : '定时'}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (value) => {
        const colorMap = {
          success: 'green',
          skipped: 'grey',
          failed: 'red',
        };
        return <Tag color={colorMap[value] || 'grey'}>{value}</Tag>;
      },
    },
    { title: '消息', dataIndex: 'message' },
  ];

  const winnerColumns = [
    { title: '记录 ID', dataIndex: 'id' },
    { title: '运行批次', dataIndex: 'run_id' },
    { title: '用户 ID', dataIndex: 'user_id' },
    { title: '用户名', dataIndex: 'username' },
    { title: '分组', dataIndex: 'group' },
    { title: '奖励额度', dataIndex: 'reward_quota' },
    {
      title: '中奖时间',
      render: (_, record) =>
        record.won_at ? formatDateTimeString(new Date(record.won_at * 1000)) : '-',
    },
  ];

  return (
    <div className='mt-[60px] px-2'>
      <CardPro
        type='type3'
        descriptionArea={
          <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-3 w-full'>
            <div>
              <Typography.Title heading={5} style={{ margin: 0 }}>
                抽奖活动
              </Typography.Title>
              <Typography.Text type='secondary'>
                管理定时抽奖活动、立即执行、查看执行记录和中奖名单
              </Typography.Text>
            </div>
            <div className='flex justify-start md:justify-end'>
              <Button type='primary' onClick={openCreateModal}>
                新建活动
              </Button>
            </div>
          </div>
        }
        t={(key) => key}
      >
        {activities.length === 0 ? (
          <Empty description='暂无抽奖活动' />
        ) : (
          <Table
            rowKey='id'
            dataSource={activities}
            columns={activityColumns}
            loading={loading}
            pagination={false}
          />
        )}
      </CardPro>

      <Modal
        title={editingActivity ? '编辑抽奖活动' : '新建抽奖活动'}
        visible={showEditModal}
        onCancel={closeEditModal}
        onOk={() => formApi?.submitForm()}
        confirmLoading={submitting}
        size='large'
      >
        <Form
          key={editingActivity?.id || 'create'}
          initValues={toFormValues(editingActivity || {})}
          getFormApi={(api) => setFormApi(api)}
          onValueChange={(firstArg, secondArg) =>
            setLiveFormValues((prev) =>
              mergeLiveFormValues(prev, firstArg, secondArg),
            )
          }
          onSubmit={handleSubmitActivity}
        >
          <Form.Input field='name' label='活动名称' required />
          <Form.Switch field='enabled' label='启用状态' />
          <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
            <Form.InputNumber field='days' label='最近几天' min={1} required />
            <Form.Input
              field='run_time'
              label='每天执行时间'
              placeholder='23:50'
              extraText='请按 HH:mm 格式填写，例如 23:50'
              rules={[
                {
                  pattern: /^([01]\d|2[0-3]):([0-5]\d)$/,
                  message: '执行时间格式无效，必须为 HH:mm',
                },
              ]}
              required
            />
            <Form.Select
              field='consume_status'
              label='消费状态'
              optionList={[
                { label: '全部', value: 'all' },
                { label: '已消费', value: 'consumed' },
                { label: '未消费', value: 'not_consumed' },
              ]}
            />
            <Form.Select
              field='checkin_status'
              label='签到状态'
              optionList={[
                { label: '全部', value: 'all' },
                { label: '已签到', value: 'checked' },
                { label: '未签到', value: 'not_checked' },
              ]}
            />
            <Form.InputNumber
              field='min_consume_amount'
              label='最低消费金额（0 表示不限制）'
              min={0}
              step={0.01}
              extraText={`当前原生额度：${Number(
                renderUnitWithQuota(Number(liveFormValues?.min_consume_amount || 0)),
              ) || 0}`}
              disabled={liveFormValues?.consume_status === 'not_consumed'}
            />
            <Form.Input field='group' label='分组（可选）' />
            <Form.Input field='keyword' label='关键词（可选）' />
            <Form.InputNumber
              field='winner_count'
              label='中奖人数'
              min={1}
              required
            />
            <Form.InputNumber
              field='reward_amount'
              label='每人奖励金额'
              min={0.01}
              step={0.01}
              extraText={`当前原生额度：${Number(
                renderUnitWithQuota(Number(liveFormValues?.reward_amount || 0)),
              ) || 0}`}
              required
            />
            <Form.InputNumber
              field='repeat_win_block_days'
              label='N 天内不可重复中奖'
              min={0}
              required
            />
          </div>
          <Form.TextArea field='reason' label='备注' rows={3} />
        </Form>
      </Modal>

      <Modal
        title={`执行记录${selectedActivity ? ` - ${selectedActivity.name}` : ''}`}
        visible={showRunsModal}
        footer={null}
        onCancel={() => setShowRunsModal(false)}
        size='large'
      >
        <Table
          rowKey='id'
          dataSource={runsData}
          columns={runColumns}
          loading={runsLoading}
          pagination={{
            currentPage: runsPagination.page + 1,
            pageSize: runsPagination.pageSize,
            total: runsPagination.total,
            onPageChange: (page) => {
              const nextPage = page - 1;
              setRunsPagination((prev) => ({ ...prev, page: nextPage }));
              loadRuns(selectedActivity, nextPage, runsPagination.pageSize);
            },
            onPageSizeChange: (size) => {
              setRunsPagination((prev) => ({ ...prev, pageSize: size, page: 0 }));
              loadRuns(selectedActivity, 0, size);
            },
          }}
        />
      </Modal>

      <Modal
        title={`中奖名单${selectedActivity ? ` - ${selectedActivity.name}` : ''}`}
        visible={showWinnersModal}
        footer={null}
        onCancel={() => setShowWinnersModal(false)}
        size='large'
      >
        <Card bodyStyle={{ padding: 12 }} style={{ marginBottom: 12 }}>
          <Descriptions data={[{ key: '提示', value: '可选填 run_id 查看某次执行的中奖名单' }]} />
          <div className='mt-3 flex gap-2 items-end'>
            <InputNumber
              value={winnerRunId}
              min={0}
              onChange={(value) => setWinnerRunId(Number(value) || 0)}
              placeholder='run_id，0 表示全部'
            />
            <Button
              onClick={() => loadWinners(selectedActivity, 0, winnersPagination.pageSize, winnerRunId)}
            >
              查询
            </Button>
          </div>
        </Card>
        <Table
          rowKey='id'
          dataSource={winnersData}
          columns={winnerColumns}
          loading={winnersLoading}
          pagination={{
            currentPage: winnersPagination.page + 1,
            pageSize: winnersPagination.pageSize,
            total: winnersPagination.total,
            onPageChange: (page) => {
              const nextPage = page - 1;
              setWinnersPagination((prev) => ({ ...prev, page: nextPage }));
              loadWinners(selectedActivity, nextPage, winnersPagination.pageSize, winnerRunId);
            },
            onPageSizeChange: (size) => {
              setWinnersPagination((prev) => ({ ...prev, pageSize: size, page: 0 }));
              loadWinners(selectedActivity, 0, size, winnerRunId);
            },
          }}
        />
      </Modal>
    </div>
  );
};

export default LotteryPage;