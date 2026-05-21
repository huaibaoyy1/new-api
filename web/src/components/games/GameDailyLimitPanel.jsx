import React from 'react';
import { Button } from '@douyinfe/semi-ui';
import { IconGift, IconPulse } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';

const formatAmount = (value) => {
  const number = Number(value || 0);
  return number.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
};

const chipBaseStyle = {
  alignItems: 'center',
  borderRadius: 8,
  borderStyle: 'solid',
  borderWidth: 1,
  boxShadow: '0 8px 18px rgba(15, 23, 42, 0.14)',
  display: 'inline-flex',
  fontSize: 14,
  fontWeight: 900,
  gap: 6,
  minHeight: 34,
  padding: '5px 12px',
};

const GameDailyLimitPanel = ({
  dailyLimit,
  onClaim,
  claiming = false,
  className = '',
  dark = false,
}) => {
  const { t } = useTranslation();
  if (!dailyLimit) return null;

  const playLimit = Number(dailyLimit.play_limit || 0);
  const playCount = Number(dailyLimit.play_count || 0);
  const remaining = Number(dailyLimit.remaining_count || 0);
  const netBalance = Number(dailyLimit.net_balance || 0);
  const canClaim = Boolean(dailyLimit.can_claim_relief);
  const reliefClaimed = Boolean(dailyLimit.relief_claimed);
  const panelStyle = {
    background: dark ? '#fffaf0' : 'rgba(255, 255, 255, 0.96)',
    borderColor: dark ? '#fde68a' : '#e2e8f0',
    color: '#0f172a',
    boxShadow: dark
      ? '0 18px 44px rgba(0, 0, 0, 0.34)'
      : '0 12px 28px rgba(15, 23, 42, 0.1)',
  };
  const countChipStyle = remaining > 0
    ? {
        ...chipBaseStyle,
        background: '#0f172a',
        borderColor: '#67e8f9',
        color: '#ecfeff',
      }
    : {
        ...chipBaseStyle,
        background: '#881337',
        borderColor: '#fecdd3',
        color: '#fff1f2',
      };
  const netChipStyle = netBalance >= 0
    ? {
        ...chipBaseStyle,
        background: '#dcfce7',
        borderColor: '#86efac',
        color: '#052e16',
      }
    : {
        ...chipBaseStyle,
        background: '#fef3c7',
        borderColor: '#fbbf24',
        color: '#451a03',
      };
  const claimedChipStyle = {
    ...chipBaseStyle,
    background: '#dcfce7',
    borderColor: '#86efac',
    color: '#052e16',
  };
  const hintStyle = {
    color: '#334155',
    fontSize: 13,
    fontWeight: 900,
    lineHeight: 1.5,
    margin: 0,
    WebkitTextFillColor: '#334155',
  };

  return (
    <div
      className={className}
      style={{
        ...panelStyle,
        borderRadius: 16,
        borderStyle: 'solid',
        borderWidth: 2,
        marginBottom: className?.includes('mb-6') ? undefined : 0,
        padding: '12px 16px',
      }}
    >
      <div
        style={{
          alignItems: 'center',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            alignItems: 'center',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            minWidth: 0,
          }}
        >
          <span style={countChipStyle}>
            <IconPulse />
            {t('今日次数')} {playCount}/{playLimit}
          </span>
          <span style={netChipStyle}>
            {t('今日净额')} {netBalance > 0 ? '+' : ''}
            {formatAmount(netBalance)}
          </span>
          {reliefClaimed && (
            <span style={claimedChipStyle}>
              {t('救助已领取')}
            </span>
          )}
        </div>
        {canClaim ? (
          <Button
            theme='solid'
            type='warning'
            icon={<IconGift />}
            loading={claiming}
            onClick={onClaim}
          >
            {t('领取救助资金')} {formatAmount(dailyLimit.relief_amount)}
          </Button>
        ) : (
          <span style={hintStyle}>
            {reliefClaimed
              ? t('今日救助已领取')
              : `${t('救助门槛')} -${formatAmount(dailyLimit.relief_threshold)}`}
          </span>
        )}
      </div>
    </div>
  );
};

export default GameDailyLimitPanel;
