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

import React, { useEffect, useState } from 'react';
import { Button, Card, List, Modal, Space, Spin, Tag, Typography } from '@douyinfe/semi-ui';
import {
  IconBolt,
  IconHistory,
  IconRefresh,
  IconTreeTriangleDown,
} from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess, showWarning } from '../../helpers';
import GameQuickSwitch from '../../components/games/GameQuickSwitch';
import GameDailyLimitPanel from '../../components/games/GameDailyLimitPanel';

const { Title, Text, Paragraph } = Typography;

const lightText = { color: '#f8fbff' };
const mutedText = { color: 'rgba(248, 251, 255, 0.72)' };
const darkTitleText = { color: '#082f49' };
const darkBodyText = { color: '#0f3a4d' };
const cardBodyStyle = { background: 'transparent', padding: 0 };
const nodeLabels = ['星门', '秘径', '回廊'];
const layerNames = [
  '启程门',
  '流光廊',
  '星砂庭',
  '雾隐台',
  '曜石阶',
  '天穹殿',
  '终焉宝库',
];
const layerSuccessTexts = [
  '初印觉醒',
  '流光入袋',
  '星砂共鸣',
  '雾锁已开',
  '曜石生辉',
  '天穹回应',
  '宝库开启',
];

const formatAmount = (value) => {
  const number = Number(value || 0);
  return number.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
};

const formatTime = (timestamp) => {
  if (!timestamp) return '-';
  return new Date(timestamp * 1000).toLocaleString();
};

const getRoundResultText = (round, t) => {
  if (round?.result === 'failed') return t('探宝失败');
  if (round?.result === 'completed') return `${t('完成探宝')} +${formatAmount(round.payout_amount)}`;
  if (round?.result === 'cashout') return `${t('带走奖励')} +${formatAmount(round.payout_amount)}`;
  return t('探宝中');
};

const getLayerName = (layer) => layerNames[Math.max(0, layer - 1)] || '未知秘境';
const getLayerSuccessText = (layer) =>
  layerSuccessTexts[Math.max(0, layer - 1)] || '秘印已成';

const LayerRail = ({ round, maxLayer = 5 }) => {
  const steps = round?.steps || [];
  return (
    <div className='grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7'>
      {Array.from({ length: maxLayer }).map((_, index) => {
        const layer = index + 1;
        const step = steps.find((item) => item.layer === layer);
        const active = round?.status === 'playing' && round?.current_layer + 1 === layer;
        const success = step?.outcome === 'success';
        const failed = step?.outcome === 'failed';
        return (
          <div
            key={layer}
            className={`rounded-2xl border p-3 text-center shadow-lg ${
              failed
                ? 'border-rose-200 bg-rose-400 text-[#27020a]'
                : success
                  ? 'treasure-layer-success border-cyan-100 bg-cyan-300 text-[#032027]'
                  : active
                    ? 'border-amber-300 bg-amber-100 text-[#3a2103]'
                    : 'border-slate-200 bg-slate-100 text-slate-700'
            }`}
          >
            <div className='text-xs font-bold'>{getLayerName(layer)}</div>
            <div className='mt-1 text-sm font-black'>
              {failed
                ? '裂隙关闭'
                : success
                  ? getLayerSuccessText(layer)
                  : active
                    ? '正在探寻'
                    : '尘封未启'}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const NodePicker = ({ disabled, acting, onPick }) => {
  return (
    <div className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
      {nodeLabels.map((label, index) => (
        <button
          key={label}
          disabled={disabled || acting}
          onClick={() => onPick(index)}
          className='group min-h-32 rounded-3xl border border-cyan-200 bg-white p-4 text-left text-slate-900 shadow-[0_18px_36px_rgba(8,47,73,0.16)] transition hover:-translate-y-1 hover:border-cyan-500 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-50'
        >
          <div className='mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-300 text-[#041e2a] shadow-lg shadow-cyan-950/40'>
            <IconBolt />
          </div>
          <div className='text-lg font-black'>{label}</div>
          <div className='mt-1 text-sm font-semibold text-slate-600'>踏入后判定本层命运</div>
        </button>
      ))}
    </div>
  );
};

const QuotaTreasure = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [activeRound, setActiveRound] = useState(null);
  const [selectedBet, setSelectedBet] = useState(1);
  const [acting, setActing] = useState(false);
  const [reliefClaiming, setReliefClaiming] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/games/quota-treasure/status');
      const { success, message, data } = res.data || {};
      if (!success) {
        showError(message || t('获取游戏状态失败'));
        return;
      }
      setStatus(data);
      setActiveRound(data?.current_round || null);
      if (!selectedBet && data?.bet_amounts?.length > 0) {
        setSelectedBet(data.bet_amounts[0]);
      }
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  };

  const claimRelief = async () => {
    setReliefClaiming(true);
    try {
      const res = await API.post('/api/games/relief/claim');
      const { success, message } = res.data || {};
      if (!success) {
        showError(message || t('领取救助资金失败'));
        return;
      }
      showSuccess(t('救助资金已领取'));
      await loadStatus();
    } catch (error) {
      showError(error);
    } finally {
      setReliefClaiming(false);
    }
  };

  const createRound = async () => {
    setActing(true);
    try {
      const res = await API.post('/api/games/quota-treasure/rounds', {
        bet_amount: selectedBet,
      });
      const { success, message, data } = res.data || {};
      if (!success) {
        showError(message || t('开局失败'));
        return;
      }
      setActiveRound(data);
      await loadStatus();
      setActiveRound(data);
      showSuccess(t('额度探宝已开始'));
    } catch (error) {
      showError(error);
    } finally {
      setActing(false);
    }
  };

  const pickNode = async (position) => {
    if (!activeRound?.id) return;
    setActing(true);
    try {
      const res = await API.post(`/api/games/quota-treasure/rounds/${activeRound.id}/pick`, {
        position,
      });
      const { success, message, data } = res.data || {};
      if (!success) {
        showError(message || t('探宝失败'));
        return;
      }
      setActiveRound(data);
      await loadStatus();
      setActiveRound(data);
      if (data.status === 'failed') {
        showWarning(t('探宝失败，本局结束'));
      } else if (data.status === 'settled') {
        showSuccess(`${t('完成探宝')} +${formatAmount(data.payout_amount)} ${t('站内余额')}`);
      } else {
        showSuccess(`${t(getLayerSuccessText(data.current_layer))}，${t('恭喜通过')} ${t(getLayerName(data.current_layer))}`);
      }
    } catch (error) {
      showError(error);
    } finally {
      setActing(false);
    }
  };

  const cashout = async () => {
    if (!activeRound?.id) return;
    setActing(true);
    try {
      const res = await API.post(`/api/games/quota-treasure/rounds/${activeRound.id}/cashout`);
      const { success, message, data } = res.data || {};
      if (!success) {
        showError(message || t('带走奖励失败'));
        return;
      }
      setActiveRound(data);
      await loadStatus();
      setActiveRound(data);
      showSuccess(`${t('已带走')} +${formatAmount(data.payout_amount)} ${t('站内余额')}`);
    } catch (error) {
      showError(error);
    } finally {
      setActing(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const dailyRemaining = Number(status?.daily_limit?.remaining_count ?? 1);
  const canStart =
    Number(status?.user_balance || 0) >= selectedBet &&
    dailyRemaining > 0 &&
    !activeRound;
  const currentLayer = activeRound?.current_layer || 0;
  const nextLayer = Math.min(currentLayer + 1, status?.max_layer || 7);
  const settled = activeRound && activeRound.status !== 'playing';

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
    <div className='min-h-[calc(100vh-64px)] bg-[radial-gradient(circle_at_15%_0%,#174e67_0%,#0b2132_38%,#060d19_100%)] px-4 pb-10 pt-24 text-[#f8fbff] md:px-8'>
      <div className='mx-auto max-w-6xl'>
        <div className='mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between'>
          <div>
            <div className='mb-3 inline-flex rounded-full border border-cyan-100/60 bg-cyan-300/15 px-4 py-1 text-sm font-semibold text-cyan-50'>
              {t('七层遗迹 · 三道秘门 · 后段高倍率')}
            </div>
            <Title heading={2} className='!mb-2' style={lightText}>
              {t('额度探宝')}
            </Title>
            <Paragraph className='!mb-0 max-w-2xl text-base' style={mutedText}>
              {t('逐层踏入秘门，通行后可收手带走奖励，也可继续挑战更高倍率。')}
            </Paragraph>
          </div>
          <Space wrap>
            <Button theme='solid' type='tertiary' icon={<IconHistory />} onClick={() => setHistoryVisible(true)}>
              {t('探宝记录')}
            </Button>
            <Button theme='solid' type='tertiary' icon={<IconRefresh />} onClick={loadStatus}>
              {t('刷新')}
            </Button>
          </Space>
        </div>

        <GameQuickSwitch currentKey='quota-treasure' className='mb-6' />

        <GameDailyLimitPanel
          dailyLimit={status?.daily_limit}
          onClaim={claimRelief}
          claiming={reliefClaiming}
          dark
          className='mb-6 relative z-10'
        />

        <div className='mb-6 grid grid-cols-1 items-stretch gap-5 lg:grid-cols-3 xl:h-[640px]'>
          <Card
            className='h-full overflow-hidden lg:col-span-2 xl:min-h-0'
            style={{
              background: '#f8fbff',
              border: '1px solid rgba(125, 211, 252, 0.72)',
              boxShadow: '0 24px 70px rgba(0,0,0,0.28)',
            }}
            bodyStyle={{ ...cardBodyStyle, height: '100%' }}
          >
            <div className='flex h-full min-h-0 flex-col p-5 md:p-6'>
              <div className='mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
                <div>
                  <Text style={darkBodyText}>{t('当前站内余额')}</Text>
                  <div className='mt-1 text-3xl font-black text-[#082f49]'>
                    {formatAmount(status?.user_balance)}
                  </div>
                </div>
                {activeRound && (
                  <Tag color={settled ? (activeRound.status === 'failed' ? 'red' : 'green') : 'cyan'} size='large'>
                    {getRoundResultText(activeRound, t)}
                  </Tag>
                )}
              </div>

              {activeRound ? (
                <div className='flex min-h-0 flex-1 flex-col space-y-5 overflow-y-auto pr-1'>
                  <LayerRail round={activeRound} maxLayer={status?.max_layer || 7} />

                  <div className='rounded-3xl border border-cyan-200 bg-[#e9f8ff] p-5 shadow-inner shadow-cyan-900/10'>
                    <div className='mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
                      <div>
                        <div className='text-sm font-bold text-[#0f3a4d]'>
                          {activeRound.status === 'playing' ? t('当前进度') : t('本局结果')}
                        </div>
                        <div className='text-2xl font-black text-[#082f49]'>
                          {activeRound.status === 'playing'
                            ? `${t('当前第')} ${nextLayer} ${t('幕')} · ${t(getLayerName(nextLayer))}`
                            : getRoundResultText(activeRound, t)}
                        </div>
                      </div>
                      <div className='grid grid-cols-2 gap-3 text-right'>
                        <div className='rounded-2xl border border-cyan-200 bg-white px-4 py-2'>
                          <div className='text-xs font-bold text-slate-500'>{t('当前倍率')}</div>
                          <div className='text-lg font-black text-[#075985]'>
                            {activeRound.current_multiplier || 0}x
                          </div>
                        </div>
                        <div className='rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2'>
                          <div className='text-xs font-bold text-slate-500'>{t('可带走')}</div>
                          <div className='text-lg font-black text-[#92400e]'>
                            {formatAmount(activeRound.current_payout_amount)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {activeRound.status === 'playing' ? (
                      <NodePicker disabled={!activeRound.can_pick} acting={acting} onPick={pickNode} />
                    ) : (
                      <div className='rounded-3xl border border-cyan-200 bg-white p-6 text-center text-slate-900'>
                        <IconTreeTriangleDown className='mb-3 text-5xl text-cyan-600' />
                        <div className='text-2xl font-black'>{getRoundResultText(activeRound, t)}</div>
                        <div className='mt-2 font-semibold text-slate-600'>{t('可以调整入场额后直接再探一次。')}</div>
                      </div>
                    )}
                  </div>

                  <div className='flex flex-col gap-3 md:flex-row'>
                    {activeRound.status === 'playing' ? (
                      <>
                        <Button
                          block
                          size='large'
                          theme='solid'
                          type='warning'
                          loading={acting}
                          disabled={!activeRound.can_cashout}
                          onClick={cashout}
                        >
                          {t('带走奖励')}
                        </Button>
                        <Button block size='large' disabled>
                          {t('踏入秘门继续探宝')}
                        </Button>
                      </>
                    ) : (
                      <Button
                        block
                        size='large'
                        theme='solid'
                        type='warning'
                        loading={acting}
                        disabled={Number(status?.user_balance || 0) < selectedBet || dailyRemaining <= 0}
                        onClick={createRound}
                      >
                        {t('再探一次')}
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className='flex min-h-0 flex-1 flex-col items-center justify-center rounded-3xl border-2 border-dashed border-cyan-300 bg-[#e9f8ff] p-10 text-center shadow-inner shadow-cyan-900/10'>
                  <IconTreeTriangleDown className='mb-4 text-5xl text-cyan-600' />
                  <Title heading={4} style={darkTitleText}>
                    {t('选择入场额开始探宝')}
                  </Title>
                  <Text style={darkBodyText}>
                    {t('成功后可以带走奖励，也可以继续下一层；失败则本局结束。')}
                  </Text>
                </div>
              )}
            </div>
          </Card>

          <Card
            className='h-full overflow-hidden xl:min-h-0'
            style={{
              background: '#fffaf0',
              border: '1px solid rgba(251, 191, 36, 0.72)',
              boxShadow: '0 24px 70px rgba(0,0,0,0.22)',
            }}
            bodyStyle={{ ...cardBodyStyle, height: '100%' }}
          >
            <div className='h-full overflow-y-auto p-5 md:p-6'>
              <Title heading={4} style={{ color: '#3a2103' }}>
                {t('入场额度')}
              </Title>
              <Paragraph style={{ color: '#6b3f08' }}>
                {t('单局最高派奖 50 站内余额。')}
              </Paragraph>
              <div className='grid grid-cols-3 gap-3'>
                {(status?.bet_amounts || [1, 5, 10]).map((amount) => (
                  <button
                    key={amount}
                    className={`rounded-full border px-4 py-3 text-center font-black transition ${
                      selectedBet === amount
                        ? 'border-amber-500 bg-amber-300 text-[#241005] shadow-lg shadow-amber-900/20'
                        : 'border-amber-300 bg-white text-[#6b3f08] hover:bg-amber-50'
                    }`}
                    onClick={() => setSelectedBet(amount)}
                  >
                    {amount}
                  </button>
                ))}
              </div>
              <Button
                block
                className='mt-5'
                size='large'
                theme='solid'
                type='primary'
                loading={acting}
                disabled={!canStart}
                onClick={createRound}
              >
                {activeRound ? t('当前探宝未结束') : t('开始探宝')}
              </Button>
              <div className='mt-5 space-y-2'>
                {(status?.rules || []).map((rule, index) => (
                  <div key={rule} className='rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-semibold leading-6 text-[#6b3f08]'>
                    {index + 1}. {t(rule)}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        <Modal
          title={t('探宝记录')}
          visible={historyVisible}
          onCancel={() => setHistoryVisible(false)}
          footer={null}
          bodyStyle={{ maxHeight: 'min(560px, calc(100vh - 260px))', overflowY: 'auto' }}
        >
          <List
            dataSource={status?.recent_rounds || []}
            emptyContent={t('暂无探宝记录')}
            renderItem={(round) => (
              <List.Item
                main={
                  <div className='flex items-center justify-between gap-3'>
                    <div>
                      <Text strong>
                        {t('入场')} {round.bet_amount} · {t(getLayerName(round.current_layer || 1))}
                      </Text>
                      <div className='text-sm text-semi-color-text-2'>{formatTime(round.created_at)}</div>
                    </div>
                    <Tag color={round.status === 'failed' ? 'red' : round.status === 'playing' ? 'cyan' : 'green'}>
                      {getRoundResultText(round, t)}
                    </Tag>
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

export default QuotaTreasure;
