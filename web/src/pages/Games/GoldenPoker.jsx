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
import {
  Button,
  Card,
  List,
  Modal,
  Space,
  Spin,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import { IconHistory, IconRefresh, IconTickCircle } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess, showWarning } from '../../helpers';
import GameQuickSwitch from '../../components/games/GameQuickSwitch';
import GameDailyLimitPanel from '../../components/games/GameDailyLimitPanel';

const { Title, Text, Paragraph } = Typography;

const suitMap = {
  spade: { label: '黑桃', symbol: '♠', color: 'text-slate-950' },
  heart: { label: '红心', symbol: '♥', color: 'text-red-600' },
  club: { label: '梅花', symbol: '♣', color: 'text-slate-950' },
  diamond: { label: '方块', symbol: '♦', color: 'text-red-600' },
};

const rankMap = {
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
};

const lightText = { color: '#f8f5e7' };
const mutedText = { color: 'rgba(248, 245, 231, 0.74)' };
const faintText = { color: 'rgba(248, 245, 231, 0.58)' };
const cardBodyStyle = { background: 'transparent', padding: 0 };
const handTypeChipStyle = {
  background: 'linear-gradient(135deg, #fff7d6 0%, #facc15 100%)',
  borderColor: '#fde68a',
  color: '#3a2103',
  boxShadow: '0 10px 22px rgba(0, 0, 0, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.65)',
  textShadow: '0 1px 0 rgba(255, 255, 255, 0.45)',
};
const resultWinStyle = {
  background: 'linear-gradient(135deg, #ecfdf5 0%, #86efac 100%)',
  borderColor: '#bbf7d0',
  color: '#052e16',
  boxShadow: '0 18px 36px rgba(6, 78, 59, 0.35)',
};
const resultLoseStyle = {
  background: 'linear-gradient(135deg, #fff7d6 0%, #fbbf24 100%)',
  borderColor: '#fde68a',
  color: '#3a2103',
  boxShadow: '0 18px 36px rgba(120, 53, 15, 0.35)',
};
const resultBadgeStyle = {
  background: 'rgba(255, 255, 255, 0.72)',
  border: '1px solid rgba(255, 255, 255, 0.82)',
  color: '#1f2937',
};

const formatAmount = (value) => {
  const number = Number(value || 0);
  return number.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
};

const formatTime = (timestamp) => {
  if (!timestamp) return '-';
  return new Date(timestamp * 1000).toLocaleString();
};

const formatRank = (rank) => rankMap[rank] || String(rank);

const getRoundResultText = (round, t) => {
  if (round?.result === 'win') {
    return `${t('玩家胜利')} +${formatAmount(round.payout_amount)} ${t('站内余额')}`;
  }
  return t('庄家胜');
};

const CardFace = ({ card, hidden = false, index = 0, reveal = false }) => {
  const animationClass = hidden
    ? 'golden-poker-card-back'
    : reveal
      ? 'golden-poker-card-reveal'
      : 'golden-poker-card-deal';
  const style = { animationDelay: `${index * 120}ms` };

  if (hidden) {
    return (
      <div
        className={`relative flex h-28 w-20 flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-amber-200 bg-[linear-gradient(135deg,#d97706,#7f1d1d)] text-3xl font-black text-white shadow-[0_14px_24px_rgba(0,0,0,0.35)] ${animationClass}`}
        style={style}
      >
        <span className='relative z-10'>?</span>
      </div>
    );
  }

  const suit = suitMap[card?.suit] || suitMap.spade;
  return (
    <div
      className={`relative flex h-28 w-20 flex-col justify-between overflow-hidden rounded-2xl border-2 border-amber-100 bg-[#fffaf0] p-2 shadow-[0_14px_24px_rgba(0,0,0,0.32)] ${animationClass}`}
      style={style}
      aria-label={`${suit.label}${formatRank(card?.rank)}`}
    >
      <div className={`flex items-center justify-between text-base font-black ${suit.color}`}>
        <span>{formatRank(card?.rank)}</span>
        <span>{suit.symbol}</span>
      </div>
      <div className={`text-center ${suit.color}`}>
        <div className='text-4xl leading-none'>{suit.symbol}</div>
        <div className='mt-1 rounded-full bg-white/80 px-1 text-[11px] font-black'>
          {suit.label}
        </div>
      </div>
      <div className={`self-end text-base font-black ${suit.color}`}>{formatRank(card?.rank)}</div>
    </div>
  );
};

const HandView = ({ title, cards = [], hand, hidden = false, dealer = false }) => {
  return (
    <div className='relative h-[168px] overflow-hidden rounded-3xl border border-emerald-200/30 bg-[#0b3324] p-4 shadow-inner shadow-black/25'>
      <span className='absolute left-4 top-4 z-10 text-base font-bold text-[#f8f5e7]'>
        {title}
      </span>
      {hand?.type_label && !hidden && (
        <span
          className='absolute right-4 top-4 z-10 rounded-full border px-4 py-1 text-sm font-black'
          style={handTypeChipStyle}
        >
          {hand.type_label}
        </span>
      )}
      <div className='absolute inset-x-0 bottom-5 flex justify-center gap-3'>
        {hidden
          ? [0, 1, 2].map((index) => <CardFace key={index} hidden index={index} />)
          : cards.map((card, index) => (
              <CardFace
                key={`${card.suit}-${card.rank}-${index}`}
                card={card}
                index={index}
                reveal={dealer}
              />
            ))}
      </div>
    </div>
  );
};

const GoldenPoker = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [activeRound, setActiveRound] = useState(null);
  const [selectedBet, setSelectedBet] = useState(1);
  const [acting, setActing] = useState(false);
  const [reliefClaiming, setReliefClaiming] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);

  const loadStatus = async ({ syncActiveRound = true } = {}) => {
    setLoading(true);
    try {
      const res = await API.get('/api/games/golden-poker/status');
      const { success, message, data } = res.data || {};
      if (!success) {
        showError(message || t('获取游戏状态失败'));
        return;
      }
      setStatus(data);
      if (syncActiveRound) {
        setActiveRound(data?.current_round || null);
      }
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
      await loadStatus({ syncActiveRound: false });
    } catch (error) {
      showError(error);
    } finally {
      setReliefClaiming(false);
    }
  };

  const createRound = async () => {
    setActing(true);
    try {
      const res = await API.post('/api/games/golden-poker/rounds', {
        bet_amount: selectedBet,
      });
      const { success, message, data } = res.data || {};
      if (!success) {
        showError(message || t('开局失败'));
        return;
      }
      setActiveRound(data);
      await loadStatus({ syncActiveRound: false });
      showSuccess(t('牌局已开始'));
    } catch (error) {
      showError(error);
    } finally {
      setActing(false);
    }
  };

  const swapCard = async () => {
    if (!activeRound?.id) return;
    setActing(true);
    try {
      const res = await API.post(`/api/games/golden-poker/rounds/${activeRound.id}/swap`);
      const { success, message, data } = res.data || {};
      if (!success) {
        showError(message || t('换牌失败'));
        return;
      }
      setActiveRound(data);
      showSuccess(t('换牌完成，请比牌结算'));
    } catch (error) {
      showError(error);
    } finally {
      setActing(false);
    }
  };

  const settleRound = async () => {
    if (!activeRound?.id) return;
    setActing(true);
    try {
      const res = await API.post(`/api/games/golden-poker/rounds/${activeRound.id}/settle`);
      const { success, message, data } = res.data || {};
      if (!success) {
        showError(message || t('结算失败'));
        return;
      }
      setActiveRound(data);
      await loadStatus({ syncActiveRound: false });
      if (data?.result === 'win') {
        showSuccess(`${t('胜利')} +${formatAmount(data.payout_amount)} ${t('站内余额')}`);
      } else {
        showWarning(t('本局未获胜'));
      }
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
    <div className='min-h-[calc(100vh-64px)] bg-[radial-gradient(circle_at_20%_0%,#23523c_0%,#102a1f_34%,#08140f_100%)] px-4 pb-10 pt-24 text-[#f8f5e7] md:px-8'>
      <div className='mx-auto max-w-6xl'>
        <div className='mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between'>
          <div>
            <div className='mb-3 inline-flex rounded-full border border-amber-200/70 bg-amber-300/20 px-4 py-1 text-sm font-semibold text-amber-50 shadow-sm'>
              {t('系统庄家 · 可换一张 · 即时结算')}
            </div>
            <Title heading={2} className='!mb-2' style={lightText}>
              {t('额度牌局')}
            </Title>
            <Paragraph className='!mb-0 max-w-2xl text-base' style={mutedText}>
              {t('三张牌挑战庄家，选择入场额后可直接比牌或换 1 张牌，胜利按牌型倍率获得站内余额。')}
            </Paragraph>
          </div>
          <Space wrap>
            <Button theme='solid' type='tertiary' icon={<IconHistory />} onClick={() => setHistoryVisible(true)}>
              {t('最近牌局')}
            </Button>
            <Button theme='solid' type='tertiary' icon={<IconRefresh />} onClick={loadStatus}>
              {t('刷新')}
            </Button>
          </Space>
        </div>

        <GameQuickSwitch currentKey='golden-poker' className='mb-6' />

        <GameDailyLimitPanel
          dailyLimit={status?.daily_limit}
          onClaim={claimRelief}
          claiming={reliefClaiming}
          dark
          className='mb-6 relative z-10'
        />

        <div className='mb-6 grid grid-cols-1 gap-5 lg:grid-cols-3'>
          <Card
            className='overflow-hidden lg:col-span-2'
            style={{
              background: 'linear-gradient(145deg, #17643f 0%, #0d3a29 55%, #08251b 100%)',
              border: '1px solid rgba(250, 204, 21, 0.34)',
              boxShadow: '0 24px 70px rgba(0,0,0,0.36)',
            }}
            bodyStyle={cardBodyStyle}
          >
            <div className='relative p-5 md:p-6'>
              <div className='mb-5 min-h-[148px] md:min-h-[72px]'>
                <div>
                  <Text style={mutedText}>{t('当前站内余额')}</Text>
                  <div className='mt-1 text-3xl font-black text-amber-200'>
                    {formatAmount(status?.user_balance)}
                  </div>
                </div>
                {activeRound?.status === 'settled' && (
                  <div
                    className='golden-poker-result-pill absolute left-5 right-5 top-[92px] rounded-2xl border px-4 py-3 text-right md:left-auto md:right-6 md:top-6 md:max-w-[320px]'
                    style={activeRound.result === 'win' ? resultWinStyle : resultLoseStyle}
                  >
                    <div className='text-xs font-black tracking-[0.18em]'>{t('本局结果')}</div>
                    <div className='text-xl font-black leading-tight'>{getRoundResultText(activeRound, t)}</div>
                    <div className='mt-1 flex flex-wrap justify-end gap-2 text-xs font-black'>
                      <span className='rounded-full px-2 py-0.5' style={resultBadgeStyle}>
                        {t('我的牌型')}：{activeRound.player_hand?.type_label || '-'}
                      </span>
                      <span className='rounded-full px-2 py-0.5' style={resultBadgeStyle}>
                        {t('庄家牌型')}：{activeRound.dealer_hand?.type_label || '-'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {activeRound ? (
                <div className='space-y-5'>
                  <HandView
                    title={t('庄家手牌')}
                    cards={activeRound.dealer_cards}
                    hand={activeRound.dealer_hand}
                    hidden={activeRound.status !== 'settled'}
                    dealer
                  />
                  <HandView
                    title={t('我的手牌')}
                    cards={activeRound.player_cards}
                    hand={activeRound.player_hand}
                  />
                  <div className='flex flex-col gap-3 md:flex-row'>
                    {activeRound.status === 'settled' ? (
                      <Button
                        block
                        size='large'
                        theme='solid'
                        type='warning'
                        loading={acting}
                        disabled={Number(status?.user_balance || 0) < selectedBet || dailyRemaining <= 0}
                        onClick={createRound}
                      >
                        {t('再来一局')}
                      </Button>
                    ) : (
                      <>
                        <Button
                          block
                          size='large'
                          theme='solid'
                          type='warning'
                          loading={acting}
                          disabled={!activeRound.can_swap}
                          onClick={swapCard}
                        >
                          {activeRound.swapped ? t('已换牌') : t('免费换 1 张')}
                        </Button>
                        <Button
                          block
                          size='large'
                          theme='solid'
                          type='primary'
                          loading={acting}
                          disabled={!activeRound.can_settle}
                          onClick={settleRound}
                        >
                          {t('立即比牌')}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className='rounded-3xl border-2 border-dashed border-amber-100/50 bg-[#0b3324] p-10 text-center shadow-inner shadow-black/25'>
                  <IconTickCircle className='mb-4 text-5xl text-amber-200' />
                  <Title heading={4} style={lightText}>
                    {t('选择入场额开始牌局')}
                  </Title>
                  <Text style={mutedText}>
                    {t('开局后将立即扣除入场额，结算前只能保留一个未完成牌局。')}
                  </Text>
                </div>
              )}
            </div>
          </Card>

          <Card
            className='overflow-hidden'
            style={{
              background: 'linear-gradient(160deg, #3a1f0f 0%, #251207 58%, #160b05 100%)',
              border: '1px solid rgba(251, 191, 36, 0.42)',
              boxShadow: '0 24px 70px rgba(0,0,0,0.34)',
            }}
            bodyStyle={cardBodyStyle}
          >
            <div className='p-5 md:p-6'>
              <Title heading={4} style={lightText}>
                {t('筹码入场')}
              </Title>
              <Paragraph style={mutedText}>
                {t('单局最高派奖')} {formatAmount(status?.max_payout || 50)} {t('站内余额')}。
              </Paragraph>
              <div className='grid grid-cols-3 gap-3'>
                {(status?.bet_amounts || [1, 5, 10]).map((amount) => (
                  <button
                    key={amount}
                    className={`group relative overflow-hidden rounded-2xl border px-3 py-3 text-center transition ${
                      selectedBet === amount
                        ? 'border-amber-100 bg-[linear-gradient(135deg,#fff7d6_0%,#f59e0b_100%)] text-[#2b1203] shadow-lg shadow-amber-900/30'
                        : 'border-amber-300/70 bg-[#4a210c] text-amber-50 shadow-inner shadow-black/25 hover:border-amber-100 hover:bg-[#66320f]'
                    }`}
                    onClick={() => setSelectedBet(amount)}
                  >
                    <span className='block text-2xl font-black leading-none tracking-tight'>
                      {amount}
                    </span>
                    <span
                      className={`mt-1 block text-[11px] font-bold ${
                        selectedBet === amount ? 'text-[#5b2505]' : 'text-amber-100'
                      }`}
                    >
                      {t('站内余额')}
                    </span>
                  </button>
                ))}
              </div>
              <Button
                block
                className='mt-5'
                size='large'
                theme='solid'
                type='warning'
                loading={acting}
                disabled={!canStart}
                onClick={createRound}
              >
                {activeRound ? t('当前牌局未结束') : t('开始牌局')}
              </Button>
              <div className='mt-5 space-y-2'>
                {(status?.rules || []).map((rule, index) => (
                  <div key={rule} className='rounded-xl bg-black/20 px-3 py-2 text-sm leading-6' style={faintText}>
                    {index + 1}. {t(rule)}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        <Modal
          title={t('最近牌局')}
          visible={historyVisible}
          onCancel={() => setHistoryVisible(false)}
          footer={null}
          bodyStyle={{ maxHeight: 'min(560px, calc(100vh - 260px))', overflowY: 'auto' }}
        >
          <List
            dataSource={status?.recent_rounds || []}
            emptyContent={t('暂无牌局记录')}
            renderItem={(round) => (
              <List.Item
                main={
                  <div className='flex items-center justify-between gap-3'>
                    <div>
                      <Text strong>
                        {t('入场')} {round.bet_amount} · {round.player_hand?.type_label}
                      </Text>
                      <div className='text-sm text-semi-color-text-2'>{formatTime(round.created_at)}</div>
                    </div>
                    <Tag color={round.result === 'win' ? 'green' : round.status === 'playing' ? 'orange' : 'red'}>
                      {round.status === 'playing'
                        ? t('进行中')
                        : round.result === 'win'
                          ? `+${formatAmount(round.payout_amount)}`
                          : t('未获胜')}
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

export default GoldenPoker;
