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
  List,
  Modal,
  Progress,
  Space,
  Spin,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import {
  IconGift,
  IconHistory,
  IconRefresh,
  IconCopy,
  IconShoppingBag,
} from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { API, copy, showError, showSuccess } from '../../helpers';
import GameQuickSwitch from '../../components/games/GameQuickSwitch';

const { Title, Text, Paragraph } = Typography;

const rewardTypeMap = {
  balance: {
    color: 'blue',
    label: '站内余额',
  },
  quota: {
    color: 'blue',
    label: '站内余额',
  },
  register_fragment: {
    color: 'cyan',
    label: '注册码碎片',
  },
  consume_fragment: {
    color: 'green',
    label: '消费码碎片',
  },
  cube: {
    color: 'purple',
    label: '幸运魔方',
  },
  register_code: {
    color: 'violet',
    label: '注册码',
  },
  consume_code: {
    color: 'orange',
    label: '消费码',
  },
};

const formatAmount = (value) => {
  const number = Number(value || 0);
  return number.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
};

const formatRemainingTime = (seconds) => {
  const totalSeconds = Math.max(0, Number(seconds || 0));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  if (days > 0) {
    return `${days} 天 ${hours} 小时`;
  }
  return `${hours} 小时`;
};

const formatTime = (timestamp) => {
  if (!timestamp) return '-';
  return new Date(timestamp * 1000).toLocaleString();
};

const isCodeExpired = (timestamp) => {
  return Number(timestamp || 0) > 0 && Number(timestamp) < Math.floor(Date.now() / 1000);
};

const isCodeReward = (rewardType) => {
  return rewardType === 'register_code' || rewardType === 'consume_code';
};

const MagicCube = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [drawing, setDrawing] = useState(false);
  const [claimingDraws, setClaimingDraws] = useState(null);
  const [exchangingId, setExchangingId] = useState(null);
  const [status, setStatus] = useState(null);
  const [exchangeVisible, setExchangeVisible] = useState(false);
  const [logsVisible, setLogsVisible] = useState(false);
  const [exchangeRecordsVisible, setExchangeRecordsVisible] = useState(false);
  const [lastRewards, setLastRewards] = useState([]);
  const [exchangeRecords, setExchangeRecords] = useState([]);
  const [exchangeRecordsLoading, setExchangeRecordsLoading] = useState(false);
  const [createdCodes, setCreatedCodes] = useState([]);
  const [drawSpinReward, setDrawSpinReward] = useState(null);
  const [drawAnimating, setDrawAnimating] = useState(false);
  const [winningCellIndex, setWinningCellIndex] = useState(null);

  const progressPercent = useMemo(() => {
    if (!status?.pity_count) {
      return 0;
    }
    return Math.min(
      100,
      Math.round((status.pity_progress / status.pity_count) * 100),
    );
  }, [status?.pity_count, status?.pity_progress]);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/games/magic-cube/status');
      const { success, message, data } = res.data || {};
      if (!success) {
        showError(message || t('获取游戏状态失败'));
        return;
      }
      setStatus(data);
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  };

  const loadExchangeRecords = async () => {
    setExchangeRecordsLoading(true);
    try {
      const res = await API.get('/api/games/magic-cube/exchanges');
      const { success, message, data } = res.data || {};
      if (!success) {
        showError(message || t('获取兑换记录失败'));
        return;
      }
      setExchangeRecords(data || []);
    } catch (error) {
      showError(error);
    } finally {
      setExchangeRecordsLoading(false);
    }
  };

  const addCreatedCode = (code, sourceName, rewardName, expiredTime, rewardType) => {
    if (!code) return;
    setCreatedCodes((records) => [
      {
        id: `${Date.now()}-${code}`,
        code,
        sourceName: sourceName || t('魔方兑换'),
        rewardName: rewardName || t('兑换码'),
        rewardType,
        expiredTime: expiredTime || 0,
        createdAt: new Date().toLocaleString(),
      },
      ...records,
    ]);
  };

  const draw = async (count) => {
    setDrawing(true);
    try {
      const res = await API.post('/api/games/magic-cube/draw', { count });
      const { success, message, data } = res.data || {};
      if (!success) {
        showError(message || t('抽奖失败'));
        return;
      }

      const rewards = data?.rewards || [];
      setLastRewards(rewards);
      if (count === 1 && rewards.length > 0) {
        setDrawSpinReward(null);
        setWinningCellIndex(null);
        setDrawAnimating(true);
        window.setTimeout(() => {
          setDrawAnimating(false);
          setDrawSpinReward(rewards[0]);
          setWinningCellIndex(getRewardCellIndex(rewards[0]));
          window.setTimeout(() => {
            setDrawSpinReward(null);
            setWinningCellIndex(null);
          }, 1300);
        }, 950);
      } else {
        setDrawAnimating(false);
        setDrawSpinReward(null);
        setWinningCellIndex(null);
      }
      showSuccess(t('抽奖完成'));
      await loadStatus();

      if (data?.new_claimable_milestones?.length > 0) {
        showSuccess(t('有新的阶段奖励可以领取'));
      }
    } catch (error) {
      showError(error);
    } finally {
      setDrawing(false);
    }
  };

  const claimMilestone = async (milestoneDraws) => {
    setClaimingDraws(milestoneDraws);
    try {
      const res = await API.post('/api/games/magic-cube/milestones/claim', {
        milestone_draws: milestoneDraws,
      });
      const { success, message, data } = res.data || {};
      if (!success) {
        showError(message || t('领取失败'));
        return;
      }

      if (data?.created_code) {
        const milestone = (status?.milestones || []).find(
          (item) => item.draws === milestoneDraws,
        );
        addCreatedCode(
          data.created_code,
          `${milestoneDraws} ${t('次阶段奖励')}`,
          milestone?.reward?.name,
          data.created_code_expired_time,
          milestone?.reward?.type,
        );
      }
      showSuccess(t('阶段奖励已领取'));
      await loadStatus();
      await loadExchangeRecords();
    } catch (error) {
      showError(error);
    } finally {
      setClaimingDraws(null);
    }
  };

  const exchangeItem = async (itemId) => {
    setExchangingId(itemId);
    try {
      const res = await API.post('/api/games/magic-cube/exchange', {
        item_id: itemId,
      });
      const { success, message, data } = res.data || {};
      if (!success) {
        showError(message || t('兑换失败'));
        return;
      }

      if (data?.created_code) {
        const item = (status?.exchange_items || []).find(
          (exchange) => exchange.id === itemId,
        );
        addCreatedCode(
          data.created_code,
          item?.name,
          item?.reward?.name,
          data.created_code_expired_time,
          item?.reward?.type,
        );
      }
      showSuccess(t('兑换成功'));
      await loadStatus();
      await loadExchangeRecords();
    } catch (error) {
      showError(error);
    } finally {
      setExchangingId(null);
    }
  };

  useEffect(() => {
    loadStatus();
    loadExchangeRecords();
  }, []);

  const renderRewardTag = (reward) => {
    const meta = rewardTypeMap[reward?.type || reward?.reward_type] || {
      color: 'grey',
      label: '奖励',
    };
    return <Tag color={meta.color}>{t(meta.label)}</Tag>;
  };

  const canDraw = (count) => Number(status?.user_balance || 0) >= count;
  const treasureRewards = [
    { title: '幸运魔方', detail: 'x1', type: 'cube' },
    { title: '注册码碎片', detail: 'x1 - x3', type: 'register_fragment' },
    { title: '消费码碎片', detail: 'x1 - x3', type: 'consume_fragment' },
    { title: '站内余额', detail: '随机', type: 'balance' },
    { title: '注册码碎片', detail: 'x1 - x3', type: 'register_fragment' },
    { title: '消费码碎片', detail: 'x1 - x3', type: 'consume_fragment' },
    { title: '站内余额', detail: '随机', type: 'balance' },
    { title: '幸运魔方', detail: 'x1', type: 'cube' },
  ];

  const getRewardCellIndex = (reward) => {
    const rewardType = reward?.type || reward?.reward_type;
    const normalizedType = rewardType === 'quota' ? 'balance' : rewardType;
    const matchIndex = treasureRewards.findIndex(
      (item) => item.type === normalizedType,
    );
    return matchIndex >= 0 ? matchIndex : null;
  };

  const renderTreasureCell = (reward, index, className = '') => (
    <div
      className={`magic-cube-prize-cell flex min-h-[84px] flex-col items-center justify-center rounded-2xl border-2 border-[#f7cf67] bg-white/85 p-2 text-center shadow-inner ${
        winningCellIndex === index ? 'magic-cube-prize-win' : ''
      } ${className}`}
    >
      <div className='text-base font-black text-[#7a3f16]'>
        {t(reward.title)}
      </div>
      <Text className='mt-1 text-xs !font-bold !text-[#7a4a22]'>
        {t(reward.detail)}
      </Text>
    </div>
  );

  const getOwnedExchangeAmount = (item) => {
    if (!item) return 0;
    if (item.cost_type === 'cube') {
      return status?.cube_count || 0;
    }
    if (item.cost_type === 'register_fragment') {
      return status?.register_code_fragments || 0;
    }
    if (item.cost_type === 'consume_fragment') {
      return status?.consume_code_fragments || 0;
    }
    return 0;
  };

  const getExchangeCostLabel = (item) => {
    if (!item) return t('材料');
    if (item.cost_type === 'cube') {
      return t('幸运魔方');
    }
    if (item.cost_type === 'register_fragment') {
      return t('注册码碎片');
    }
    return t('消费码碎片');
  };

  const getExchangeMissingAmount = (item) =>
    Math.max(0, (item?.cost_amount || 0) - getOwnedExchangeAmount(item));

  const canExchange = (item) => {
    if (!item) return false;
    return getOwnedExchangeAmount(item) >= item.cost_amount;
  };

  if (loading && !status) {
    return (
      <div className='min-h-[calc(100vh-64px)] px-4 pb-10 pt-24 md:px-8'>
        <div className='mx-auto flex max-w-6xl justify-center py-20'>
          <Spin size='large' />
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-[calc(100vh-64px)] bg-semi-color-bg-0 px-4 pb-10 pt-24 md:px-8'>
      <div className='mx-auto max-w-[1500px]'>
        <div className='mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
          <div>
            <Title heading={2} className='!mb-2'>
              {t('幸运魔方补给站')}
            </Title>
            <Paragraph className='!mb-0 text-semi-color-text-1'>
              {t('抽取补给，获得幸运魔方、碎片和站内余额奖励。')}
            </Paragraph>
          </div>
          <Space wrap>
            <Button
              icon={<IconHistory />}
              onClick={() => setLogsVisible(true)}
            >
              {t('最近记录')}
            </Button>
            <Button
              icon={<IconShoppingBag />}
              type='primary'
              theme='solid'
              onClick={() => setExchangeVisible(true)}
            >
              {t('兑换商城')}
            </Button>
            <Button
              icon={<IconCopy />}
              onClick={() => setExchangeRecordsVisible(true)}
            >
              {t('我的兑换记录')}
            </Button>
            <Button icon={<IconRefresh />} onClick={loadStatus}>
              {t('刷新')}
            </Button>
          </Space>
        </div>

        <GameQuickSwitch currentKey='magic-cube' className='mb-6' />

        <div className='mb-6 grid grid-cols-1 items-stretch gap-5 xl:h-[650px] xl:grid-cols-[280px_minmax(520px,1fr)_600px]'>
          <Card
            className='h-full min-h-[650px] overflow-hidden xl:min-h-0'
            bodyStyle={{ height: '100%' }}
          >
            <Title heading={4}>{t('活动规则')}</Title>
            <div className='mt-2 max-h-[540px] overflow-y-auto pr-1'>
              <List
                dataSource={status?.rules || []}
                renderItem={(rule, index) => (
                  <List.Item>
                    <Text>
                      {index + 1}. {t(rule)}
                    </Text>
                  </List.Item>
                )}
              />
            </div>
          </Card>

          <Card
            className='h-full min-h-[650px] overflow-hidden xl:min-h-0'
            bodyStyle={{ padding: 0, height: '100%' }}
          >
            <div className='relative h-full overflow-hidden rounded-xl bg-[radial-gradient(circle_at_50%_18%,#fff7cf_0%,#f4c76d_36%,#b9732d_72%,#6b3517_100%)] p-3 md:p-4'>
              <div className='absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.16)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.12)_1px,transparent_1px)] bg-[size:28px_28px] opacity-35' />
              <div className='relative rounded-3xl border-4 border-[#f8e0a6] bg-[#fff1bf]/90 p-3 shadow-[inset_0_0_0_2px_rgba(120,69,22,0.2),0_18px_45px_rgba(74,35,12,0.28)]'>
                <div className='mb-3 flex flex-col gap-2 md:flex-row md:items-end md:justify-between'>
                  <div>
                    <Title
                      heading={4}
                      className='!mb-1 !text-[#5a2a0e]'
                    >
                      {t('幸运魔方盘')}
                    </Title>
                    <Text className='text-[#7a4a22]'>
                      {t('奖品已装填，选择次数后即可开启补给。')}
                    </Text>
                  </div>
                  <div className='rounded-2xl bg-[#5a2a0e]/90 px-4 py-2 text-right text-[#ffe8a3] shadow-lg'>
                    <div className='text-xs font-bold opacity-80'>
                      {t('周期剩余')}
                    </div>
                    <div className='text-lg font-black'>
                      {formatRemainingTime(status?.cycle_remaining_seconds)}
                    </div>
                  </div>
                </div>

                <div
                  className={`relative grid grid-cols-1 gap-2 sm:grid-cols-3 ${
                    drawAnimating ? 'magic-cube-board-spin' : ''
                  }`}
                >
                  {renderTreasureCell(treasureRewards[0], 0)}
                  {renderTreasureCell(treasureRewards[1], 1)}
                  {renderTreasureCell(treasureRewards[2], 2)}
                  {renderTreasureCell(treasureRewards[3], 3)}

                  <div className='relative flex min-h-[150px] items-center justify-center rounded-3xl border-4 border-[#f3b544] bg-[radial-gradient(circle,#fff2a6_0%,#ffbf45_48%,#d97706_100%)] shadow-[inset_0_0_0_8px_rgba(255,255,255,0.28),0_16px_30px_rgba(120,53,15,0.28)]'>
                    <div className='absolute inset-5 rounded-full border-[10px] border-dashed border-white/45' />
                    {drawAnimating ? (
                      <div className='relative text-center'>
                        <div className='text-2xl font-black leading-tight text-[#9a3412] drop-shadow-sm'>
                          {t('补给开启中')}
                        </div>
                        <div className='mt-2 text-sm font-bold text-[#7a4a22]'>
                          {t('奖池锁定中')}
                        </div>
                      </div>
                    ) : drawSpinReward ? (
                      <div className='magic-cube-win-pop relative text-center'>
                        <div className='text-sm font-black text-[#7a4a22]'>
                          {t('本次获得')}
                        </div>
                        <div className='mt-2 text-3xl font-black text-[#9a3412]'>
                          {t(drawSpinReward.reward_name)}
                        </div>
                      </div>
                    ) : (
                      <div className='relative text-center'>
                        <div className='text-2xl font-black leading-tight text-[#9a3412] drop-shadow-sm'>
                          {t('开启补给')}
                        </div>
                        <div className='mt-2 text-sm font-bold text-[#7a4a22]'>
                          {t('奖池待命')}
                        </div>
                      </div>
                    )}
                  </div>

                  {renderTreasureCell(treasureRewards[4], 4)}
                  {renderTreasureCell(treasureRewards[5], 5)}
                  {renderTreasureCell(treasureRewards[6], 6)}
                  {renderTreasureCell(treasureRewards[7], 7)}
                </div>

                <div className='mt-3 rounded-2xl bg-[#7a3f16]/90 p-3 shadow-inner'>
                  <div className='mb-2 flex items-center justify-between text-sm font-bold text-[#ffe8a3]'>
                    <span>{t('幸运值')}</span>
                    <span>
                      {status?.pity_progress || 0} / {status?.pity_count || 100}
                    </span>
                  </div>
                  <Progress
                    percent={progressPercent}
                    stroke='#facc15'
                    trailColor='rgba(255,255,255,0.25)'
                    aria-label={t('幸运值进度')}
                  />
                </div>
              </div>
              <div className='relative mt-3 grid grid-cols-2 gap-2 pb-1 md:grid-cols-5'>
                <div className='min-h-[66px] rounded-2xl border border-[#f5c15f] bg-[#fff8dc] p-2 text-center shadow'>
                  <div className='text-lg font-black text-[#4a2208]'>
                    {formatAmount(status?.user_balance)}
                  </div>
                  <Text className='text-xs !font-bold !text-[#4a2208]'>{t('站内余额')}</Text>
                </div>
                <div className='min-h-[66px] rounded-2xl border border-[#f5c15f] bg-[#fff8dc] p-2 text-center shadow'>
                  <div className='text-lg font-black text-[#4a2208]'>
                    {status?.cube_count || 0}
                  </div>
                  <Text className='text-xs !font-bold !text-[#4a2208]'>{t('幸运魔方')}</Text>
                </div>
                <div className='min-h-[66px] rounded-2xl border border-[#f5c15f] bg-[#fff8dc] p-2 text-center shadow'>
                  <div className='text-lg font-black text-[#4a2208]'>
                    {status?.register_code_fragments || 0}
                  </div>
                  <Text className='text-xs !font-bold !text-[#4a2208]'>{t('注册码碎片')}</Text>
                </div>
                <div className='min-h-[66px] rounded-2xl border border-[#f5c15f] bg-[#fff8dc] p-2 text-center shadow'>
                  <div className='text-lg font-black text-[#4a2208]'>
                    {status?.consume_code_fragments || 0}
                  </div>
                  <Text className='text-xs !font-bold !text-[#4a2208]'>{t('消费码碎片')}</Text>
                </div>
                <div className='min-h-[66px] rounded-2xl border border-[#f5c15f] bg-[#fff8dc] p-2 text-center shadow'>
                  <div className='text-lg font-black text-[#4a2208]'>
                    {status?.total_draws || 0}
                  </div>
                  <Text className='text-xs !font-bold !text-[#4a2208]'>{t('本周期抽奖')}</Text>
                </div>
              </div>
            </div>
          </Card>

          <div className='grid h-full grid-cols-1 items-stretch gap-5 md:grid-cols-2'>
            <Card
              className='h-full min-h-[650px] overflow-hidden xl:min-h-0'
              bodyStyle={{ height: '100%' }}
            >
              <div className='flex h-full min-h-0 flex-col overflow-hidden'>
                <Title heading={4}>{t('开始寻宝')}</Title>
                <Paragraph className='text-semi-color-text-1'>
                  {t('抽奖有机会获得幸运魔方、注册码碎片、消费码碎片和随机站内余额。')}
                </Paragraph>
                <div className='grid grid-cols-1 gap-3'>
                  <Button
                    block
                    size='large'
                    theme='solid'
                    type='primary'
                    loading={drawing}
                    disabled={!canDraw(1)}
                    onClick={() => draw(1)}
                  >
                    {t('消耗 1 金额抽 1 次')}
                  </Button>
                  <Button
                    block
                    size='large'
                    theme='solid'
                    type='warning'
                    loading={drawing}
                    disabled={!canDraw(5)}
                    onClick={() => draw(5)}
                  >
                    {t('消耗 5 金额抽 5 次')}
                  </Button>
                  <Button
                    block
                    size='large'
                    theme='solid'
                    type='tertiary'
                    loading={drawing}
                    disabled={!canDraw(10)}
                    onClick={() => draw(10)}
                  >
                    {t('消耗 10 金额抽 10 次')}
                  </Button>
                  <Button
                    block
                    size='large'
                    theme='solid'
                    type='danger'
                    loading={drawing}
                    disabled={!canDraw(50)}
                    onClick={() => draw(50)}
                  >
                    {t('消耗 50 金额抽 50 次')}
                  </Button>
                </div>

                <div className='mt-5 border-t border-semi-color-border pt-5'>
                  <div className='mb-3 flex items-center gap-2'>
                    <IconGift />
                    <Title heading={5} className='!mb-0'>
                      {t('累计抽奖阶段奖励')}
                    </Title>
                  </div>
                  <div className='grid max-h-[255px] grid-cols-1 gap-3 overflow-y-auto pr-1'>
                    {(status?.milestones || []).map((milestone) => (
                      <div
                        key={milestone.draws}
                        className='rounded-xl border border-semi-color-border bg-semi-color-fill-0 p-2.5'
                      >
                        <div className='mb-2 flex items-center justify-between gap-2'>
                          <Text strong>
                            {milestone.draws} {t('次')}
                          </Text>
                          {milestone.status === 'claimed' && (
                            <Tag color='green'>{t('已领取')}</Tag>
                          )}
                          {milestone.status === 'claimable' && (
                            <Tag color='orange'>{t('可领取')}</Tag>
                          )}
                          {milestone.status === 'locked' && (
                            <Tag color='grey'>{t('未达成')}</Tag>
                          )}
                        </div>
                        <div className='mb-2 flex items-center gap-2'>
                          {renderRewardTag(milestone.reward)}
                          <Text>{t(milestone.reward.name)}</Text>
                        </div>
                        <Button
                          block
                          size='small'
                          disabled={milestone.status !== 'claimable'}
                          loading={claimingDraws === milestone.draws}
                          onClick={() => claimMilestone(milestone.draws)}
                        >
                          {milestone.status === 'claimable'
                            ? t('领取')
                            : t('暂不可领取')}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </Card>

            <Card
              className='h-full min-h-[650px] overflow-hidden xl:min-h-0'
              bodyStyle={{ height: '100%' }}
            >
              <div className='flex h-full min-h-0 flex-col overflow-hidden'>
                <Title heading={4} className='!mb-3'>
                  {t('本次获得')}
                </Title>
                {lastRewards.length > 0 ? (
                  <div className='grid max-h-[540px] min-h-0 flex-1 grid-cols-1 gap-2 overflow-y-auto pr-1'>
                    {lastRewards.map((reward, index) => (
                      <div
                        key={`${reward.draw_no}-${index}`}
                        className='rounded-xl border border-semi-color-border bg-semi-color-fill-0 p-2.5'
                      >
                        <div className='mb-2'>{renderRewardTag(reward)}</div>
                        <Text strong>{t(reward.reward_name)}</Text>
                        {reward.is_pity && (
                          <div className='mt-2'>
                            <Tag color='purple'>{t('保底')}</Tag>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className='flex min-h-0 flex-1 items-center justify-center rounded-xl border border-dashed border-semi-color-border p-4 text-center'>
                    <Text type='secondary'>{t('抽取后在这里查看本次奖励')}</Text>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>

        <Modal
          title={t('兑换商城')}
          visible={exchangeVisible}
          onCancel={() => setExchangeVisible(false)}
          footer={null}
          width={920}
          bodyStyle={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}
        >
          <div>
            <div className='mb-3 rounded-2xl bg-gradient-to-r from-semi-color-primary-light-default to-semi-color-warning-light-default p-3'>
              <Title heading={5} className='!mb-1'>
                {t('魔方货架')}
              </Title>
              <Text type='secondary'>
                {t('选择商品后将立即扣除对应材料，兑换码会在成功后展示并可复制，生成的兑换码 72 小时内有效。')}
              </Text>
            </div>
            {createdCodes.length > 0 && (
              <div className='mb-3 rounded-2xl border border-semi-color-success bg-semi-color-success-light-default p-3'>
                <div className='mb-2 flex items-center justify-between gap-3'>
                  <Text strong>{t('本次生成的兑换码')}</Text>
                  <Button
                    size='small'
                    type='primary'
                    theme='solid'
                    onClick={async () => {
                      const copied = await copy(createdCodes[0].code);
                      if (copied) showSuccess(t('已复制'));
                    }}
                  >
                    {t('复制最新')}
                  </Button>
                </div>
                <div className='max-h-[82px] overflow-y-auto pr-1'>
                  {createdCodes.map((record) => (
                    <div
                      key={record.id}
                      className='mb-2 rounded-xl bg-semi-color-bg-0 p-2 last:mb-0'
                    >
                      <div className='mb-2 flex flex-wrap items-center gap-2'>
                        <Tag color='green'>{t(record.rewardName)}</Tag>
                        <Text type='secondary'>{t(record.sourceName)}</Text>
                        <Text type='tertiary'>{record.createdAt}</Text>
                      </div>
                      {isCodeReward(record.rewardType) && record.expiredTime > 0 && (
                        <div className='mb-2 rounded-lg border border-semi-color-warning bg-semi-color-warning-light-default px-2 py-1'>
                          <Text type='warning' size='small'>
                            {t('兑换码 72 小时内有效，请尽快使用')} · {t('过期时间')}:{' '}
                            {formatTime(record.expiredTime)}
                          </Text>
                        </div>
                      )}
                      <Text code copyable>
                        {record.code}
                      </Text>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
              {(status?.exchange_items || []).map((item) => (
                <Card
                  key={item.id}
                  className='overflow-hidden border border-semi-color-border'
                  bodyStyle={{ padding: 0 }}
                >
                  <div className='flex h-full flex-col'>
                    <div className='bg-semi-color-fill-0 p-3'>
                      <div className='mb-2 flex flex-col gap-2'>
                        <div className='min-w-0'>
                          <Title heading={5} className='!mb-1'>
                            {t(item.name)}
                          </Title>
                          <Paragraph
                            className='!mb-0 line-clamp-1 text-semi-color-text-1'
                            ellipsis={{ rows: 1, showTooltip: true }}
                          >
                            {t(item.description)}
                          </Paragraph>
                        </div>
                        <div>{renderRewardTag(item.reward)}</div>
                      </div>
                      <div className='rounded-xl border border-semi-color-border bg-semi-color-bg-0 p-2'>
                        <Text type='secondary'>{t('获得奖励')}</Text>
                        <div className='mt-1 text-lg font-semibold'>
                          {t(item.reward.name)}
                        </div>
                      </div>
                    </div>
                    <div className='flex flex-1 flex-col gap-2 p-3'>
                      <div className='grid grid-cols-2 gap-2'>
                        <div className='rounded-xl bg-semi-color-fill-0 p-2'>
                          <Text type='secondary'>{t('消耗材料')}</Text>
                          <div className='mt-1 font-semibold'>
                            {item.cost_amount} {getExchangeCostLabel(item)}
                          </div>
                        </div>
                        <div className='rounded-xl bg-semi-color-fill-0 p-2'>
                          <Text type='secondary'>{t('当前拥有')}</Text>
                          <div className='mt-1 font-semibold'>
                            {getOwnedExchangeAmount(item)} {getExchangeCostLabel(item)}
                          </div>
                        </div>
                      </div>
                      <div className='mt-auto flex flex-col gap-2'>
                        {canExchange(item) ? (
                          <div>
                            <Tag color='green'>{t('材料充足')}</Tag>
                          </div>
                        ) : (
                          <div>
                            <Tag color='orange'>
                              {t('还差')} {getExchangeMissingAmount(item)}{' '}
                              {getExchangeCostLabel(item)}
                            </Tag>
                          </div>
                        )}
                        <Button
                          block
                          theme='solid'
                          type='primary'
                          loading={exchangingId === item.id}
                          disabled={!canExchange(item)}
                          onClick={() => exchangeItem(item.id)}
                        >
                          {t('立即兑换')}
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </Modal>

        <Modal
          title={t('我的兑换记录')}
          visible={exchangeRecordsVisible}
          onCancel={() => setExchangeRecordsVisible(false)}
          footer={null}
          width={760}
          bodyStyle={{ maxHeight: 'min(560px, calc(100vh - 260px))', overflowY: 'auto' }}
        >
          <List
            loading={exchangeRecordsLoading}
            dataSource={exchangeRecords}
            emptyContent={t('暂无兑换记录')}
            renderItem={(record) => (
              <List.Item
                main={
                  <div className='flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
                    <div className='min-w-0'>
                      <div className='mb-1 flex flex-wrap items-center gap-2'>
                        <Text strong>{t(record.name)}</Text>
                        {record.type === 'invitation' ? (
                          <Tag color='violet'>{t('注册码')}</Tag>
                        ) : (
                          <Tag color='orange'>
                            {formatAmount(record.balance)} {t('站内余额')}
                          </Tag>
                        )}
                      </div>
                      <Text type='secondary'>{formatTime(record.created_time)}</Text>
                      {record.expired_time > 0 && (
                        <div className='mt-1'>
                          <Tag color={isCodeExpired(record.expired_time) ? 'red' : 'orange'}>
                            {isCodeExpired(record.expired_time)
                              ? t('已过期')
                              : t('72 小时内有效，请尽快使用')}
                          </Tag>
                          <Text type='tertiary' className='ml-2'>
                            {t('过期时间')}: {formatTime(record.expired_time)}
                          </Text>
                        </div>
                      )}
                      <div className='mt-2'>
                        <Text code copyable>
                          {record.code}
                        </Text>
                      </div>
                    </div>
                    <Button
                      type='primary'
                      theme='solid'
                      onClick={async () => {
                        const copied = await copy(record.code);
                        if (copied) showSuccess(t('已复制'));
                      }}
                    >
                      {t('复制')}
                    </Button>
                  </div>
                }
              />
            )}
          />
        </Modal>

        <Modal
          title={t('最近抽奖记录')}
          visible={logsVisible}
          onCancel={() => setLogsVisible(false)}
          footer={null}
          bodyStyle={{ maxHeight: 'min(560px, calc(100vh - 260px))', overflowY: 'auto' }}
        >
          <List
            dataSource={status?.recent_logs || []}
            emptyContent={t('暂无抽奖记录')}
            renderItem={(log) => (
              <List.Item
                main={
                  <div className='flex items-center justify-between gap-3'>
                    <Space>
                      {renderRewardTag(log)}
                      <Text>
                        #{log.draw_no} {t(log.reward_name)}
                      </Text>
                      {log.is_pity && <Tag color='purple'>{t('保底')}</Tag>}
                    </Space>
                  </div>
                }
              />
            )}
          />
        </Modal>
      </div>
    </div>
  );
};

export default MagicCube;
